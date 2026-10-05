import time

from fastapi import FastAPI
from fastapi import Request

from app.cors import configure_cors
from app.routes import analyses, auth as auth_routes, detection, health, operations, research
from app.services.request_metrics import record_request

app = FastAPI(title="API de Detecção - Armas e Ferramentas")
configure_cors(app)


@app.middleware("http")
async def collect_request_metrics(request: Request, call_next):
    started = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        route = request.scope.get("route")
        route_path = getattr(route, "path", "[unmatched]")
        record_request(
            request.method,
            str(route_path),
            status_code,
            (time.perf_counter() - started) * 1000,
        )


app.include_router(health.router, prefix="/api")
app.include_router(detection.router, prefix="/api")
app.include_router(analyses.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(research.router, prefix="/api")
app.include_router(auth_routes.router, prefix="/api")
app.include_router(auth_routes.admin_router, prefix="/api")
app.add_api_route("/detect", detection.detect_objects, methods=["POST"])


@app.get("/health")
def root_health_check():
    return {"status": "ok", "service": "SIDA-Caála Backend"}