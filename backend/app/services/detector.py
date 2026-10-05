import logging
import os

import cv2
import numpy as np
import PIL.Image
from PIL import ImageOps
from ultralytics import YOLO

from app.config import settings
from app.schemas.detection_schema import BoundingBox, DetectionResult

logger = logging.getLogger("YOLODetector")

TOOL_CLASSES_BEST2 = {"alicate", "destornillador"}
WRENCH_CLASSES_BEST = {"adjustable_wrench", "wrench-4kml"}
CONSENSUS_IOU_THRESHOLD = 0.5
SPECIALIST_IOU_THRESHOLD = 0.3


def _box_iou(box_a, box_b):
    x_min = max(box_a[0], box_b[0])
    y_min = max(box_a[1], box_b[1])
    x_max = min(box_a[2], box_b[2])
    y_max = min(box_a[3], box_b[3])
    intersection = max(0.0, x_max - x_min) * max(0.0, y_max - y_min)
    area_a = max(0.0, box_a[2] - box_a[0]) * max(0.0, box_a[3] - box_a[1])
    area_b = max(0.0, box_b[2] - box_b[0]) * max(0.0, box_b[3] - box_b[1])
    union = area_a + area_b - intersection
    return intersection / union if union else 0.0


def _box_overlap(box_a, box_b):
    x_min = max(box_a[0], box_b[0])
    y_min = max(box_a[1], box_b[1])
    x_max = min(box_a[2], box_b[2])
    y_max = min(box_a[3], box_b[3])
    intersection = max(0.0, x_max - x_min) * max(0.0, y_max - y_min)
    area_a = max(0.0, box_a[2] - box_a[0]) * max(0.0, box_a[3] - box_a[1])
    area_b = max(0.0, box_b[2] - box_b[0]) * max(0.0, box_b[3] - box_b[1])
    smaller_area = min(area_a, area_b)
    return intersection / smaller_area if smaller_area else 0.0


def _overlaps_specialist(box, specialist_box):
    return (
        _box_iou(box, specialist_box) >= SPECIALIST_IOU_THRESHOLD
        or _box_overlap(box, specialist_box) >= 0.5
    )


class YOLODetector:
    def __init__(self):
        model_path = settings.MODEL_PATH
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"best.pt não encontrado em: {model_path}")
        secondary_model_path = settings.SECONDARY_MODEL_PATH
        if not os.path.exists(secondary_model_path):
            raise FileNotFoundError(
                f"best2.pt não encontrado em: {secondary_model_path}"
            )

        logger.info(f"A carregar pesos de: {model_path}")
        self.model = YOLO(model_path)
        logger.info(f"Classes do best.pt: {self.model.names}")
        logger.info(f"A carregar pesos de confirmação: {secondary_model_path}")
        self.secondary_model = YOLO(secondary_model_path)
        logger.info(f"Classes do best2.pt: {self.secondary_model.names}")

        best_names = {name.lower() for name in self.model.names.values()}
        best2_names = {name.lower() for name in self.secondary_model.names.values()}
        missing_best_classes = WRENCH_CLASSES_BEST - best_names
        missing_best2_classes = TOOL_CLASSES_BEST2 - best2_names
        if missing_best_classes or missing_best2_classes:
            raise ValueError(
                "As classes necessárias para combinar os modelos estão ausentes: "
                f"best.pt={sorted(missing_best_classes)}, "
                f"best2.pt={sorted(missing_best2_classes)}"
            )

    def predict(self, image, conf_threshold: float = 0.25):
        if isinstance(image, np.ndarray):
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image = PIL.Image.fromarray(image)
        image = ImageOps.exif_transpose(image).convert("RGB")

        best_results = self.model.predict(
            image, conf=conf_threshold, imgsz=640, verbose=False
        )
        best2_results = self.secondary_model.predict(
            image, conf=conf_threshold, imgsz=640, verbose=False
        )
        best_detections = self._read_detections(best_results, self.model)
        best2_detections = self._read_detections(
            best2_results, self.secondary_model
        )
        selected = self._combine_detections(
            best_detections,
            best2_detections,
            {name.lower() for name in self.model.names.values()},
            {name.lower() for name in self.secondary_model.names.values()},
        )

        logger.info(
            "Deteções confirmadas/selecionadas: %s (best.pt=%s, best2.pt=%s)",
            len(selected),
            len(best_detections),
            len(best2_detections),
        )
        return [self._to_detection_result(detection) for detection in selected]

    @staticmethod
    def _read_detections(results, model):
        detections = []
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                detections.append(
                    {
                        "class_id": class_id,
                        "class_name": model.names.get(
                            class_id, f"Objeto_{class_id}"
                        ).lower(),
                        "confidence": float(box.conf[0]),
                        "bbox": tuple(float(value) for value in box.xyxy[0]),
                    }
                )
        return detections

    @staticmethod
    def _combine_detections(
        best_detections, best2_detections, best_classes, best2_classes
    ):
        best2_tools = [
            detection
            for detection in best2_detections
            if detection["class_name"] in TOOL_CLASSES_BEST2
        ]
        best_wrenches = [
            detection
            for detection in best_detections
            if detection["class_name"] in WRENCH_CLASSES_BEST
            and not any(
                _overlaps_specialist(detection["bbox"], tool["bbox"])
                for tool in best2_tools
            )
        ]
        selected_specialists = best2_tools + best_wrenches

        best_other = [
            detection
            for detection in best_detections
            if detection["class_name"] not in TOOL_CLASSES_BEST2
            and detection["class_name"] not in WRENCH_CLASSES_BEST
            and not any(
                _overlaps_specialist(detection["bbox"], specialist["bbox"])
                for specialist in best2_tools
            )
        ]
        best2_other = [
            detection
            for detection in best2_detections
            if detection["class_name"] not in TOOL_CLASSES_BEST2
            and detection["class_name"] not in WRENCH_CLASSES_BEST
            and not any(
                _overlaps_specialist(detection["bbox"], specialist["bbox"])
                for specialist in best_wrenches
            )
        ]

        specialist_boxes = [
            specialist["bbox"] for specialist in selected_specialists
        ]
        best_other = [
            detection
            for detection in best_other
            if not any(
                _overlaps_specialist(detection["bbox"], box)
                for box in specialist_boxes
            )
        ]
        best2_other = [
            detection
            for detection in best2_other
            if not any(
                _overlaps_specialist(detection["bbox"], box)
                for box in specialist_boxes
            )
        ]
        common_names = best_classes & best2_classes

        confirmed = []
        matched_best = set()
        matched_best2 = set()
        matches = []
        for best_index, best_detection in enumerate(best_other):
            for best2_index, best2_detection in enumerate(best2_other):
                if best_detection["class_name"] != best2_detection["class_name"]:
                    continue
                iou = _box_iou(best_detection["bbox"], best2_detection["bbox"])
                if iou >= CONSENSUS_IOU_THRESHOLD:
                    matches.append(
                        (iou, best_index, best2_index, best_detection, best2_detection)
                    )

        for _, best_index, best2_index, best_detection, best2_detection in sorted(
            matches, reverse=True, key=lambda match: match[0]
        ):
            if best_index in matched_best or best2_index in matched_best2:
                continue
            matched_best.add(best_index)
            matched_best2.add(best2_index)
            confirmed.append(
                {
                    **best_detection,
                    "confidence": min(
                        best_detection["confidence"], best2_detection["confidence"]
                    ),
                }
            )

        unique_best_classes = {
            detection["class_name"]
            for detection in best_other
            if detection["class_name"] not in common_names
        }
        unique_best2_classes = {
            detection["class_name"]
            for detection in best2_other
            if detection["class_name"] not in common_names
        }
        exclusive = [
            detection
            for detection in best_other
            if detection["class_name"] in unique_best_classes
        ] + [
            detection
            for detection in best2_other
            if detection["class_name"] in unique_best2_classes
        ]

        return selected_specialists + confirmed + exclusive

    @staticmethod
    def _to_detection_result(detection):
        x1, y1, x2, y2 = detection["bbox"]
        return DetectionResult(
            class_id=detection["class_id"],
            class_name=detection["class_name"],
            confidence=round(detection["confidence"], 4),
            bbox=BoundingBox(
                x_min=round(x1, 2),
                y_min=round(y1, 2),
                x_max=round(x2, 2),
                y_max=round(y2, 2),
            ),
        )


detector = YOLODetector()