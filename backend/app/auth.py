from collections.abc import Callable
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.services.supabase_service import get_supabase_client

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    id: str
    nome: str
    email: str
    role: str
    ativo: bool
    telefone: str | None = None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária.")

    try:
        client = get_supabase_client()
        auth_user = client.auth.get_user(credentials.credentials).user
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Falha ao validar utilizador autenticado")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        ) from error

    if auth_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilizador não autenticado.")

    try:
        profile = (
            client.table("profiles")
            .select("id, nome, email, telefone, role, ativo")
            .eq("id", str(auth_user.id))
            .maybe_single()
            .execute()
            .data
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Falha ao consultar perfil do utilizador autenticado")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível consultar o perfil do utilizador.",
        ) from error

    if not profile or not profile["ativo"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta inativa ou sem perfil.")

    return CurrentUser.model_validate(profile)


def require_roles(*roles: str) -> Callable:
    def check_role(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente.")
        return user

    return check_role