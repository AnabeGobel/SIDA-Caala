import os
import numpy as np
import cv2
from ultralytics import YOLO

model_path = r"models\best.pt"
print('exists:', os.path.exists(model_path))
model = YOLO(model_path)
print('names:', model.names)
print('class_count:', len(model.names))
print('task:', model.task)
print('imgsz:', getattr(model, 'imgsz', None))
print('device:', getattr(model, 'device', None))

img = np.zeros((640, 640, 3), dtype=np.uint8)
cv2.rectangle(img, (160, 160), (480, 480), (0, 255, 0), 30)
results = model(img, conf=0.05, verbose=False)
print('result_count:', len(results))
print('boxes_per_result:', [len(r.boxes) for r in results])
for i, r in enumerate(results):
    print('result', i, 'classes', [int(b.cls[0]) for b in r.boxes])
    print('confidences', [float(b.conf[0]) for b in r.boxes])
