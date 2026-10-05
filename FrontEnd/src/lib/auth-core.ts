export type UserRole = "operador" | "admin" | "investigador";

export type UserProfile = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: UserRole;
  ativo: boolean;
};

const API_URL = import.meta.env["VITE_API_URL"] || "http://localhost:8000";

export function roleHome(role: UserRole) {
  if (role === "admin") return "/dashboard-admin" as const;
  if (role === "investigador") return "/dashboard-investigador" as const;
  return "/dashboard" as const;
}

export async function fetchProfile(accessToken: string): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? "Conta inativa ou sem perfil."
        : "Não foi possível validar o perfil.",
    );
  }
  return (await response.json()) as UserProfile;
}

export async function apiRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}/api${path}`, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok)
    throw new Error(body.detail || `Pedido falhou (${response.status}).`);
  return body as T;
}

export async function apiBlobRequest(
  accessToken: string,
  path: string,
): Promise<Blob> {
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new Error(body.detail || `Pedido falhou (${response.status}).`);
  }
  return response.blob();
}
