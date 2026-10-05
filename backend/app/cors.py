from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from app.config import settings


def _cors_options() -> dict:
    return {
        "allow_origins": [
            origin.strip()
            for origin in settings.CORS_ORIGINS.split(",")
            if origin.strip()
        ],
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Authorization", "Content-Type"],
    }


def configure_cors(app: FastAPI) -> None:
    app.add_middleware(CORSMiddleware, **_cors_options())


def wrap_cors(app: ASGIApp) -> CORSMiddleware:
    return CORSMiddleware(app, **_cors_options())
