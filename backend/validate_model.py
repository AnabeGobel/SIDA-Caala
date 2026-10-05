import argparse
from pathlib import Path

from ultralytics import YOLO


def collect_images(folder: Path):
    exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts)


def main():
    parser = argparse.ArgumentParser(description='Valida o modelo YOLO em uma pasta de imagens reais.')
    parser.add_argument('--model', type=str, default='models/best.pt', help='Caminho do modelo .pt')
    parser.add_argument('--images', type=str, required=True, help='Pasta com imagens para validação')
    parser.add_argument('--conf', type=float, default=0.05, help='Limiar de confiança para deteção')
    parser.add_argument('--imgsz', type=int, default=640, help='Tamanho de entrada')
    args = parser.parse_args()

    model_path = Path(args.model)
    img_folder = Path(args.images)

    if not model_path.exists():
        raise FileNotFoundError(f'Modelo não encontrado: {model_path}')

    if not img_folder.exists() or not img_folder.is_dir():
        raise FileNotFoundError(f'Pasta de imagens não encontrada: {img_folder}')

    images = collect_images(img_folder)
    if not images:
        raise ValueError(f'Nenhuma imagem válida foi encontrada em: {img_folder}')

    model = YOLO(str(model_path))
    print(f'Classes do modelo: {model.names}')
    print(f'Imagens a validar: {len(images)}')
    print(f'Conf threshold: {args.conf}')

    total = 0
    with_detections = 0
    for image_path in images:
        results = model(str(image_path), conf=args.conf, imgsz=args.imgsz, verbose=False)
        boxes = len(results[0].boxes) if len(results) > 0 else 0
        total += boxes
        if boxes > 0:
            with_detections += 1
        print(f'{image_path.name}: boxes={boxes}')

    print('\nResumo:')
    print(f'- imagens testadas: {len(images)}')
    print(f'- imagens com deteções: {with_detections}')
    print(f'- total de boxes: {total}')


if __name__ == '__main__':
    main()
