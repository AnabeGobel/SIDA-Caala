from fastapi.testclient import TestClient
from app.main import app
from pathlib import Path

p = Path('Imagens/arma de fogo.jpg')
client = TestClient(app)
with p.open('rb') as fh:
    response = client.post('/api/detect', files={'file': (p.name, fh.read(), 'image/jpeg')}, params={'conf_threshold': 0.05})
print('status=', response.status_code)
print(response.json())
