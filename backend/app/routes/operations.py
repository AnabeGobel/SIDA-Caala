import logging
import platform
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psutil
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import require_roles
from app.config import settings
from app.services.request_metrics import get_request_metrics, started_at
from app.services.supabase_service import get_supabase_client

router = APIRouter(
    prefix="/admin/operations",
    dependencies=[Depends(require_roles("admin"))],
)
logger = logging.getLogger(__name__)
IMAGE_BUCKET = "analysis-images"
ANALYSIS_SAMPLE_SIZE = 500


def _model_status(name: str, path: str, model) -> dict:
    model_path = Path(path)
    try:
        stat = model_path.stat()
        exists = model_path.is_file()
        classes = getattr(model, "names", {})
        if isinstance(classes, dict):
            class_names = [str(classes[key]) for key in sorted(classes)]
        elif isinstance(classes, list):
            class_names = [str(class_name) for class_name in classes]
        else:
            class_names = []
        return {
            "name": name,
            "file": model_path.name,
            "available": exists,
            "size_bytes": stat.st_size if exists else None,
            "classes": class_names,
            "status": "operacional" if exists and classes else "degradado",
        }
    except OSError:
        return {
            "name": name,
            "file": model_path.name,
            "available": False,
            "size_bytes": None,
            "classes": [],
            "status": "indisponível",
        }


def _runtime_status() -> dict:
    process = psutil.Process()
    disk = psutil.disk_usage(str(Path(settings.MODEL_PATH).parent))
    memory = psutil.virtual_memory()
    return {
        "python_version": platform.python_version(),
        "operating_system": platform.platform(),
        "process_uptime_seconds": round(
            time.time() - process.create_time(), 1
        ),
        "process_cpu_percent": process.cpu_percent(interval=0.1),
        "process_memory_mb": round(process.memory_info().rss / (1024 * 1024), 1),
        "system_memory_percent": memory.percent,
        "disk_total_bytes": disk.total,
        "disk_used_bytes": disk.used,
        "disk_free_bytes": disk.free,
        "disk_used_percent": disk.percent,
    }


def _integration_checks() -> tuple[dict, dict, dict]:
    database_check: dict = {"status": "operacional", "response_ms": None}
    storage_check: dict = {"status": "operacional", "response_ms": None}
    analyses: dict = {
        "total": 0,
        "last_24_hours": 0,
        "average_inference_ms": None,
        "sampled_records": 0,
    }

    try:
        client = get_supabase_client()
    except Exception:
        logger.exception("Não foi possível inicializar o cliente Supabase")
        return (
            {
                "status": "indisponível",
                "response_ms": None,
                "error": "Não foi possível inicializar a ligação Supabase.",
            },
            {
                "status": "indisponível",
                "response_ms": None,
                "error": "Não foi possível inicializar a ligação Supabase.",
            },
            {**analyses, "total": None, "last_24_hours": None},
        )

    try:
        started = time.perf_counter()
        total_query = (
            client.table("detection_analyses")
            .select("id,inference_ms,created_at", count="exact")
            .order("created_at", desc=True)
            .limit(ANALYSIS_SAMPLE_SIZE)
            .execute()
        )
        analyses["total"] = total_query.count
        sample = total_query.data or []
        analyses["sampled_records"] = len(sample)
        inference_times = [
            row["inference_ms"]
            for row in sample
            if isinstance(row.get("inference_ms"), (int, float))
        ]
        if inference_times:
            analyses["average_inference_ms"] = round(
                sum(inference_times) / len(inference_times), 2
            )

        day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent_query = (
            client.table("detection_analyses")
            .select("id", count="exact", head=True)
            .gte("created_at", day_ago)
            .execute()
        )
        analyses["last_24_hours"] = recent_query.count
        database_check["response_ms"] = round(
            (time.perf_counter() - started) * 1000, 2
        )
    except Exception:
        logger.exception("Não foi possível consultar os indicadores da base de dados")
        database_check.update(
            {
                "status": "indisponível",
                "error": "A consulta à tabela de análises falhou.",
            }
        )
        analyses.update({"total": None, "last_24_hours": None})

    try:
        started = time.perf_counter()
        client.storage.get_bucket(IMAGE_BUCKET)
        storage_check["response_ms"] = round(
            (time.perf_counter() - started) * 1000, 2
        )
    except Exception:
        logger.exception("Não foi possível consultar o bucket de imagens")
        storage_check.update(
            {
                "status": "indisponível",
                "error": "O bucket privado de imagens não está acessível.",
            }
        )
    return database_check, storage_check, analyses


def operations_status() -> dict:
    from app.services.detector import detector

    models = [
        _model_status("Modelo principal", settings.MODEL_PATH, detector.model),
        _model_status(
            "Modelo especializado", settings.SECONDARY_MODEL_PATH, detector.secondary_model
        ),
    ]
    try:
        runtime = _runtime_status()
    except Exception:
        logger.exception("Não foi possível recolher métricas do processo")
        runtime = None
    database, storage, analyses = _integration_checks()

    model_status = (
        "operacional"
        if all(model["status"] == "operacional" for model in models)
        else "degradado"
    )
    return {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "service": {
            "name": "SIDA-Caála Backend",
            "status": "operacional",
            "started_at": started_at.isoformat(),
            "uptime_seconds": get_request_metrics()["uptime_seconds"],
        },
        "runtime": runtime,
        "models": models,
        "model_status": model_status,
        "database": database,
        "storage": storage,
        "analyses": analyses,
        "requests": get_request_metrics(),
        "configuration": {
            "api_prefix": "/api",
            "image_bucket": IMAGE_BUCKET,
            "cors_origins": [
                origin.strip()
                for origin in settings.CORS_ORIGINS.split(",")
                if origin.strip()
            ],
            "primary_model_configured": bool(settings.MODEL_PATH),
            "secondary_model_configured": bool(settings.SECONDARY_MODEL_PATH),
            "supabase_configured": bool(
                settings.SUPABASE_URL and settings.SUPABASE_KEY
            ),
        },
    }


@router.get("")
def read_operations_status():
    try:
        return operations_status()
    except Exception as error:
        logger.exception("Falha ao compor o estado operacional")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível recolher o estado operacional do sistema.",
        ) from error
