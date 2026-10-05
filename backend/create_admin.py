import argparse
from getpass import getpass

from app.services.supabase_service import get_supabase_client


def main() -> None:
    parser = argparse.ArgumentParser(description="Cria o primeiro administrador do SIDA-Caála.")
    parser.add_argument("--email", required=True, help="E-mail institucional do administrador")
    parser.add_argument("--name", required=True, help="Nome do administrador")
    args = parser.parse_args()

    password = getpass("Palavra-passe inicial (mínimo 8 caracteres): ")
    confirmation = getpass("Confirmar palavra-passe: ")
    if len(password) < 8 or password != confirmation:
        parser.error("As palavras-passe devem coincidir e ter pelo menos 8 caracteres.")

    client = get_supabase_client()
    existing_admin = (
        client.table("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1)
        .execute()
        .data
    )
    if existing_admin:
        parser.error("Já existe um administrador; este comando só cria o primeiro.")

    response = client.auth.admin.create_user(
        {
            "email": args.email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"nome": args.name},
        }
    )
    user = response.user
    if user is None:
        raise RuntimeError("O Supabase não devolveu o utilizador criado.")

    try:
        client.table("profiles").upsert(
            {
                "id": str(user.id),
                "nome": args.name,
                "email": args.email.lower(),
                "role": "admin",
                "ativo": True,
            }
        ).execute()
    except Exception:
        client.auth.admin.delete_user(str(user.id))
        raise

    print(f"Administrador criado: {args.email}")


if __name__ == "__main__":
    main()