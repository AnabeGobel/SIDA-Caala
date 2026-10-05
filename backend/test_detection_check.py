import io
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

img = Image.new('RGB', (640, 480), color=(255, 255, 255))
buf = io.BytesIO()
img.save(buf, format='JPEG')
buf.seek(0)

client = TestClient(app)
response = client.post(
    '/api/detect',
    files={'file': ('sample.jpg', buf.getvalue(), 'image/jpeg')},
    params={'conf_threshold': 0.05},
)
print('status=', response.status_code)
print(response.json())
