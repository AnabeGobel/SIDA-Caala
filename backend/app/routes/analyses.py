import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.auth import CurrentUser, require_roles
from app.services.supabase_service import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)
IMAGE_BUCKET = "analysis-images"
PAGE_SIZE = 500
ANALYSIS_COLUMNS = (
    "id, user_id, filename, image_storage_path, image_content_type, "
    "image_width, image_height, confidence_threshold, inference_ms, fps, "
    "has_alert, detections, created_at"
)


def _can_read_record(record: dict, user: CurrentUser) -> bool:
    return user.role in {"admin", "investigador"} or record["user_id"] == user.id


@router.get("/analyses")
def list_analyses(
    current_user: CurrentUser = Depends(
        require_roles("operador", "admin", "investigador")
    ),
):
    try:
        client = get_supabase_client()
        records = []
        start = 0
        while True:
            query = (
                client.table("detection_analyses")
                .select(ANALYSIS_COLUMNS)
                .order("created_at", desc=True)
                .range(start, start + PAGE_SIZE - 1)
            )
            if current_user.role not in {"admin", "investigador"}:
                query = query.eq("user_id", current_user.id)
            batch = query.execute().data or []
            records.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
            start += PAGE_SIZE
        return records
    except Exception as error:
        logger.exception("Falha ao consultar o histórico de análises")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível carregar o histórico no banco de dados.",
        ) from error


@router.get("/analyses/{analysis_id}/image")
def get_analysis_image(
    analysis_id: UUID,
    current_user: CurrentUser = Depends(
        require_roles("operador", "admin", "investigador")
    ),
):
    try:
        client = get_supabase_client()
        record = (
            client.table("detection_analyses")
            .select("user_id, image_storage_path, image_content_type")
            .eq("id", str(analysis_id))
            .maybe_single()
            .execute()
            .data
        )
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Análise não encontrada.",
            )
        if not _can_read_record(record, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para consultar esta imagem.",
            )
        image_bytes = client.storage.from_(IMAGE_BUCKET).download(
            record["image_storage_path"]
        )
        return Response(
            content=image_bytes,
            media_type=record["image_content_type"],
            headers={"Cache-Control": "private, no-store"},
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Falha ao carregar imagem da análise %s", analysis_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível carregar a imagem guardada.",
        ) from error


@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: UUID,
    current_user: CurrentUser = Depends(require_roles("operador", "admin")),
):
    try:
        client = get_supabase_client()
        record = (
            client.table("detection_analyses")
            .select("id, user_id, image_storage_path")
            .eq("id", str(analysis_id))
            .maybe_single()
            .execute()
            .data
        )
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Análise não encontrada.",
            )
        if current_user.role != "admin" and record["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para eliminar esta análise.",
            )

        client.table("detection_analyses").delete().eq(
            "id", str(analysis_id)
        ).execute()
        storage_path = record.get("image_storage_path")
        if storage_path:
            client.storage.from_(IMAGE_BUCKET).remove([storage_path])
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Falha ao eliminar a análise %s", analysis_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível eliminar a análise do histórico.",
        ) from error


@router.delete("/analyses", status_code=status.HTTP_204_NO_CONTENT)
def delete_analyses(
    current_user: CurrentUser = Depends(require_roles("operador", "admin")),
):
    try:
        client = get_supabase_client()
        records = []
        start = 0
        while True:
            query = (
                client.table("detection_analyses")
                .select("id, user_id, image_storage_path")
                .order("created_at", desc=True)
                .range(start, start + PAGE_SIZE - 1)
            )
            if current_user.role != "admin":
                query = query.eq("user_id", current_user.id)
            batch = query.execute().data or []
            records.extend(batch)
            if len(batch) < PAGE_SIZE:
                break
            start += PAGE_SIZE

        if not records:
            return Response(status_code=status.HTTP_204_NO_CONTENT)

        ids = [record["id"] for record in records]
        for offset in range(0, len(ids), 100):
            query = client.table("detection_analyses").delete().in_(
                "id", ids[offset : offset + 100]
            )
            if current_user.role != "admin":
                query = query.eq("user_id", current_user.id)
            query.execute()

        storage_paths = [
            record["image_storage_path"]
            for record in records
            if record.get("image_storage_path")
        ]
        for offset in range(0, len(storage_paths), 100):
            client.storage.from_(IMAGE_BUCKET).remove(
                storage_paths[offset : offset + 100]
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as error:
        logger.exception("Falha ao eliminar registos do histórico")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível eliminar o histórico do banco de dados.",
        ) from error
