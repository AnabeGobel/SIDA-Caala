import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from PIL import Image
from pydantic import BaseModel, Field

from app.auth import CurrentUser, require_roles
from app.config import settings
from app.services.detector import detector

router = APIRouter()
logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parents[2]
DATASET_DIR = BACKEND_DIR / "Imagens"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
MAX_EVALUATION_IMAGES = 200


class EvaluationRequest(BaseModel):
    confidence_threshold: float = Field(default=0.2, ge=0.01, le=0.99)


def _model_info(name: str, configured_path: str, model) -> dict:
    path = Path(configured_path)
    if not path.is_file():
        raise FileNotFoundError(f"Checkpoint configurado não encontrado: {path}")
    stat = path.stat()
    return {
        "name": name,
        "filename": path.name,
        "size_bytes": stat.st_size,
        "modified_at": stat.st_mtime,
        "task": model.task,
        "loaded": True,
        "classes": [
            {"id": class_id, "name": class_name}
            for class_id, class_name in sorted(model.names.items())
        ],
    }


def _image_files() -> list[Path]:
    if not DATASET_DIR.is_dir():
        raise FileNotFoundError(f"Pasta de imagens não encontrada: {DATASET_DIR}")
    return sorted(
        path
        for path in DATASET_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


@router.get("/research/models")
def list_research_models(
    current_user: CurrentUser = Depends(require_roles("admin", "investigador")),
):
    try:
        logger.info("Model catalog requested by %s", current_user.id)
        return {
            "active_model": Path(settings.MODEL_PATH).name,
            "confirmation_model": Path(settings.SECONDARY_MODEL_PATH).name,
            "models": [
                _model_info("Modelo principal", settings.MODEL_PATH, detector.model),
                _model_info(
                    "Modelo complementar",
                    settings.SECONDARY_MODEL_PATH,
                    detector.secondary_model,
                ),
            ],
        }
    except Exception as error:
        logger.exception("Falha ao consultar os modelos carregados")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível consultar os checkpoints carregados.",
        ) from error


@router.get("/research/dataset")
def get_research_dataset(
    current_user: CurrentUser = Depends(require_roles("admin", "investigador")),
):
    try:
        logger.info("Local dataset inventory requested by %s", current_user.id)
        files = _image_files()
        images = []
        for path in files:
            with Image.open(path) as image:
                width, height = image.size
            images.append(
                {
                    "filename": path.name,
                    "size_bytes": path.stat().st_size,
                    "width": width,
                    "height": height,
                    "split": "não definido",
                }
            )
        label_files = sorted((DATASET_DIR / "labels").glob("*.txt")) if (
            DATASET_DIR / "labels"
        ).is_dir() else []
        return {
            "name": DATASET_DIR.name,
            "path": str(DATASET_DIR.relative_to(BACKEND_DIR)),
            "images": images,
            "image_count": len(images),
            "labeled_image_count": len(label_files),
            "annotation_ready": bool(label_files) and len(label_files) == len(images),
            "splits": {"train": 0, "validation": 0, "test": 0},
            "note": (
                "As imagens estão disponíveis para inspeção, mas não há anotações "
                "YOLO nem separação treino/validação/teste. Não são um dataset "
                "rotulado pronto para treino ou cálculo de mAP."
            ),
        }
    except Exception as error:
        logger.exception("Falha ao consultar o conjunto local de imagens")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível consultar as imagens de investigação.",
        ) from error


@router.post("/research/evaluate")
def evaluate_research_models(
    request: EvaluationRequest,
    current_user: CurrentUser = Depends(require_roles("admin", "investigador")),
):
    try:
        logger.info("Exploratory evaluation requested by %s", current_user.id)
        image_files = _image_files()
        if not image_files:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Não há imagens disponíveis para executar a avaliação exploratória.",
            )

        selected_files = image_files[:MAX_EVALUATION_IMAGES]
        results = []
        class_counts: dict[str, int] = {}
        inference_times = []
        errors = []

        for path in selected_files:
            try:
                with Image.open(path) as source:
                    image = source.convert("RGB")
                    width, height = image.size
                    started = time.perf_counter()
                    detections = detector.predict(
                        image, conf_threshold=request.confidence_threshold
                    )
                    inference_ms = round(
                        (time.perf_counter() - started) * 1000, 2
                    )
                inference_times.append(inference_ms)
                for detection in detections:
                    class_counts[detection.class_name] = (
                        class_counts.get(detection.class_name, 0) + 1
                    )
                results.append(
                    {
                        "filename": path.name,
                        "width": width,
                        "height": height,
                        "inference_ms": inference_ms,
                        "detections": [
                            {
                                "class_id": detection.class_id,
                                "class_name": detection.class_name,
                                "confidence": detection.confidence,
                            }
                            for detection in detections
                        ],
                    }
                )
            except Exception as error:
                logger.exception("Falha ao avaliar imagem %s", path.name)
                errors.append(
                    {"filename": path.name, "message": "Falha durante a inferência."}
                )

        return {
            "image_count": len(selected_files),
            "evaluated_count": len(results),
            "skipped_count": len(errors),
            "truncated": len(image_files) > len(selected_files),
            "confidence_threshold": request.confidence_threshold,
            "mean_inference_ms": round(
                sum(inference_times) / len(inference_times), 2
            )
            if inference_times
            else 0,
            "total_detections": sum(class_counts.values()),
            "class_counts": class_counts,
            "results": results,
            "errors": errors,
            "scientific_metrics_available": False,
            "metrics_note": (
                "Precision, recall e mAP não são calculados porque as imagens "
                "não têm anotações de referência verificadas."
            ),
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Falha ao executar avaliação exploratória")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível executar a avaliação exploratória.",
        ) from error
