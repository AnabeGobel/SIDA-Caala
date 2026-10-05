import logging
import time
import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, status, Depends
from app.auth import CurrentUser, require_roles
from app.services.image_processor import ImageProcessor
from app.services.detector import detector
from app.services.supabase_service import get_supabase_client
from app.schemas.detection_schema import DetectionResponse

router = APIRouter()
logger = logging.getLogger(__name__)
ANALYSIS_IMAGE_BUCKET = "analysis-images"

@router.post("/detect", response_model=DetectionResponse, summary="Executa a deteção YOLOv8 numa imagem")
async def detect_objects(
    file: UploadFile = File(...),
    conf_threshold: float = Query(default=0.20, ge=0.01, le=0.99),
    current_user: CurrentUser = Depends(require_roles("operador", "admin", "investigador")),
):
    # 1. Validação simples do tipo de ficheiro
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O ficheiro enviado deve ser uma imagem (JPEG, PNG, etc.)."
        )

    uploaded_image = False
    storage_path = ""
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O ficheiro de imagem está vazio.",
            )
        cv_image = ImageProcessor.bytes_to_image(image_bytes)
        image_height, image_width = cv_image.shape[:2]

        started_at = time.perf_counter()
        detections = detector.predict(cv_image, conf_threshold=conf_threshold)
        inference_ms = max(0, round((time.perf_counter() - started_at) * 1000))
        fps = 1000 / inference_ms if inference_ms else 0
        analysis_id = str(uuid.uuid4())
        safe_filename = (
            (file.filename or "imagem").replace("\\", "/").split("/")[-1]
            or "imagem"
        )
        storage_path = f"{current_user.id}/{analysis_id}/{safe_filename}"

        client = get_supabase_client()
        client.storage.from_(ANALYSIS_IMAGE_BUCKET).upload(
            storage_path,
            image_bytes,
            {"content-type": file.content_type, "upsert": "false"},
        )
        uploaded_image = True

        created = client.table("detection_analyses").insert(
            {
                "id": analysis_id,
                "user_id": current_user.id,
                "filename": safe_filename,
                "image_storage_path": storage_path,
                "image_content_type": file.content_type,
                "image_width": image_width,
                "image_height": image_height,
                "confidence_threshold": conf_threshold,
                "inference_ms": inference_ms,
                "fps": fps,
                "has_alert": any(
                    detection.confidence >= conf_threshold
                    for detection in detections
                ),
                "detections": [
                    detection.model_dump(mode="json")
                    for detection in detections
                ],
            }
        ).execute()
        if not created.data:
            raise RuntimeError("O banco de dados não confirmou o registo da análise.")
        record = created.data[0]

        success = len(detections) > 0
        message = (
            "Deteção realizada com sucesso."
            if success
            else "Nenhuma deteção foi encontrada na imagem para o limiar atual."
        )

        return DetectionResponse(
            success=success,
            total_detections=len(detections),
            detections=detections,
            image_url=f"/api/analyses/{analysis_id}/image",
            analysis_id=analysis_id,
            created_at=record["created_at"],
            inference_ms=inference_ms,
            fps=round(fps, 2),
            message=message
        )

    except HTTPException:
        raise
    except Exception as e:
        if uploaded_image and storage_path:
            try:
                get_supabase_client().storage.from_(ANALYSIS_IMAGE_BUCKET).remove(
                    [storage_path]
                )
            except Exception:
                logger.exception(
                    "Falha ao remover imagem após erro ao guardar análise %s",
                    storage_path,
                )
        logger.exception("Falha ao processar ou guardar imagem de deteção")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A análise não foi guardada. Verifique a ligação e a migração do Supabase.",
        ) from e