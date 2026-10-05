import cv2
import numpy as np

class ImageProcessor:
    @staticmethod
    def bytes_to_image(image_bytes: bytes):
        """Converte bytes da imagem recebida via API num array NumPy para o OpenCV."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Não foi possível processar o ficheiro de imagem enviado.")
        return img

    @staticmethod
    def encode_image_to_bytes(image) -> bytes:
        """Converte uma imagem OpenCV de volta para bytes (útil para upload)."""
        _, buffer = cv2.imencode('.jpg', image)
        return buffer.tobytes()