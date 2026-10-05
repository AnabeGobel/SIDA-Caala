import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field, model_validator

from app.auth import CurrentUser, get_current_user, require_roles
from app.config import settings
from app.services.supabase_service import get_supabase_client

router = APIRouter()
admin_router = APIRouter(prefix="/admin", dependencies=[Depends(require_roles("admin"))])
logger = logging.getLogger(__name__)
ANALYSIS_IMAGE_BUCKET = "analysis-images"


class UserInvite(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: Literal["operador", "admin", "investigador"]


class UserUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    role: Literal["operador", "admin", "investigador"] | None = None
    ativo: bool | None = None


class ProfileUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=32)
    password: str | None = Field(default=None, min_length=8)
    password_confirmation: str | None = Field(default=None, min_length=8)

    @model_validator(mode="after")
    def validate_password_confirmation(self):
        if self.password is not None or self.password_confirmation is not None:
            if not self.password or not self.password_confirmation:
                raise ValueError(
                    "Introduza a nova palavra-passe e a respetiva confirmação."
                )
            if self.password != self.password_confirmation:
                raise ValueError("As palavras-passe não coincidem.")
        return self


@router.get("/auth/me", response_model=CurrentUser)
def read_current_user(user: CurrentUser = Depends(get_current_user)):
    return user


@router.patch("/auth/profile", response_model=CurrentUser)
def update_current_profile(
    payload: ProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    changes = payload.model_dump(exclude_unset=True)
    password = changes.pop("password", None)
    changes.pop("password_confirmation", None)
    if "email" in changes and changes["email"] is not None:
        changes["email"] = str(changes["email"]).strip().lower()
    if "telefone" in changes and changes["telefone"] is not None:
        changes["telefone"] = changes["telefone"].strip() or None
    if not changes and password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma alteração enviada.",
        )

    client = get_supabase_client()
    if changes.get("email") and changes["email"] != current_user.email.lower():
        existing_email = (
            client.table("profiles")
            .select("id")
            .eq("email", changes["email"])
            .neq("id", current_user.id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este e-mail já está associado a outra conta.",
            )

    auth_changes: dict[str, str | bool] = {}
    if changes.get("email") and changes["email"] != current_user.email.lower():
        auth_changes["email"] = changes["email"]
        auth_changes["email_confirm"] = True
    if password:
        auth_changes["password"] = password

    try:
        if auth_changes:
            client.auth.admin.update_user_by_id(current_user.id, auth_changes)
        if changes:
            client.table("profiles").update(changes).eq(
                "id", current_user.id
            ).execute()
        profile = (
            client.table("profiles")
            .select("id, nome, email, telefone, role, ativo")
            .eq("id", current_user.id)
            .maybe_single()
            .execute()
            .data
        )
        if not profile:
            raise RuntimeError("O perfil atualizado não foi encontrado.")
        return profile
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Falha ao atualizar perfil do utilizador %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível atualizar o perfil. Verifique os dados e tente novamente.",
        ) from error


@admin_router.get("/users")
def list_users():
    response = (
        get_supabase_client()
        .table("profiles")
        .select("id, nome, email, telefone, role, ativo, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


@admin_router.post("/users", status_code=status.HTTP_201_CREATED)
def invite_user(payload: UserInvite):
    client = get_supabase_client()
    invited_user_id: str | None = None
    redirect_to = f"{settings.FRONTEND_URL}/redefinir-senha"
    try:
        invitation = client.auth.admin.invite_user_by_email(
            str(payload.email),
            {"data": {"nome": payload.nome}, "redirect_to": redirect_to},
        )
        invited_user = invitation.user
        if invited_user is None:
            raise ValueError("O Supabase não devolveu o utilizador convidado.")
        invited_user_id = str(invited_user.id)
        client.table("profiles").update(
            {"nome": payload.nome, "role": payload.role, "ativo": True}
        ).eq("id", invited_user_id).execute()
        profile = (
            client.table("profiles")
            .select("id, role, ativo")
            .eq("id", invited_user_id)
            .maybe_single()
            .execute()
            .data
        )
        if not profile or profile["role"] != payload.role or not profile["ativo"]:
            raise ValueError("O perfil convidado não foi ativado com a função solicitada.")
        return {"id": invited_user_id, "email": str(payload.email), "role": payload.role}
    except Exception as error:
        if invited_user_id:
            try:
                client.auth.admin.delete_user(invited_user_id)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível convidar o utilizador. Confirme se o e-mail já existe e se o SMTP está configurado.",
        ) from error


@admin_router.patch("/users/{user_id}")
def update_user(user_id: str, payload: UserUpdate, current_user: CurrentUser = Depends(get_current_user)):
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhuma alteração enviada.")

    client = get_supabase_client()
    target = (
        client.table("profiles")
        .select("id, role, ativo")
        .eq("id", user_id)
        .maybe_single()
        .execute()
        .data
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilizador não encontrado.")

    loses_admin = target["role"] == "admin" and (
        changes.get("role", "admin") != "admin" or changes.get("ativo", target["ativo"]) is False
    )
    if loses_admin:
        active_admins = (
            client.table("profiles")
            .select("id")
            .eq("role", "admin")
            .eq("ativo", True)
            .execute()
            .data
            or []
        )
        if str(target["id"]) == current_user.id or len(active_admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é permitido remover ou desativar o último administrador ativo.",
            )

    if "ativo" in changes and changes["ativo"] != target["ativo"]:
        try:
            client.auth.admin.update_user_by_id(
                user_id,
                {"ban_duration": "none" if changes["ativo"] else "876000h"},
            )
        except Exception as error:
            logger.exception("Falha ao atualizar bloqueio do utilizador %s", user_id)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Não foi possível alterar o acesso de autenticação da conta.",
            ) from error

    response = client.table("profiles").update(changes).eq("id", user_id).execute()
    return response.data[0] if response.data else {"id": user_id, **changes}


@admin_router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, current_user: CurrentUser = Depends(get_current_user)):
    client = get_supabase_client()
    target = (
        client.table("profiles")
        .select("id, role, ativo")
        .eq("id", user_id)
        .maybe_single()
        .execute()
        .data
    )
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilizador não encontrado.",
        )
    if str(target["id"]) == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é permitido eliminar a própria conta nesta página.",
        )
    if target["role"] == "admin" and target["ativo"]:
        active_admins = (
            client.table("profiles")
            .select("id")
            .eq("role", "admin")
            .eq("ativo", True)
            .execute()
            .data
            or []
        )
        if len(active_admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é permitido eliminar o último administrador ativo.",
            )

    try:
        analyses = (
            client.table("detection_analyses")
            .select("image_storage_path")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
        image_paths = [
            analysis["image_storage_path"]
            for analysis in analyses
            if analysis.get("image_storage_path")
        ]
        client.auth.admin.delete_user(user_id)
        for offset in range(0, len(image_paths), 100):
            client.storage.from_(ANALYSIS_IMAGE_BUCKET).remove(
                image_paths[offset : offset + 100]
            )
    except Exception as error:
        logger.exception("Falha ao eliminar utilizador %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Não foi possível concluir a remoção da conta ou das imagens "
                "associadas. Consulte os registos do servidor."
            ),
        ) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.post("/users/{user_id}/reset-access")
def reset_user_access(user_id: str):
    client = get_supabase_client()
    profile = (
        client.table("profiles")
        .select("email")
        .eq("id", user_id)
        .maybe_single()
        .execute()
        .data
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilizador não encontrado.")

    client.auth.reset_password_for_email(
        profile["email"], {"redirect_to": f"{settings.FRONTEND_URL}/redefinir-senha"}
    )
    return {"message": "Se o e-mail estiver ativo, receberá uma ligação para redefinir a palavra-passe."}
