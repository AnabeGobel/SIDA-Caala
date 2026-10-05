import { createFileRoute, Link } from "@tanstack/react-router";
import {
  KeyRound,
  Loader2,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { apiRequest, type UserRole } from "@/lib/auth-core";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/utilizadores")({
  head: () => ({
    meta: [
      { title: "Utilizadores / Operadores — ISPCAÁLA" },
      {
        name: "description",
        content:
          "Lista de operadores registados com acesso ao sistema de detecção de armas.",
      },
      { property: "og:title", content: "Utilizadores — ISPCAÁLA" },
      {
        property: "og:description",
        content: "Gestão de operadores do sistema.",
      },
    ],
  }),
  component: Utilizadores,
});

function Utilizadores() {
  const { session, profile } = useAuth();
  const [operadores, setOperadores] = useState<ManagedUser[]>([]);
  const [erro, setErro] = useState("");
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState("");
  const [acaoPendente, setAcaoPendente] = useState<{
    user: ManagedUser;
    type: "deactivate" | "delete";
  } | null>(null);
  const [aProcessarId, setAProcessarId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!session) return;
    try {
      setOperadores(
        await apiRequest<ManagedUser[]>(session.access_token, "/admin/users"),
      );
      setErro("");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar utilizadores.",
      );
    }
  }, [session]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function atualizar(
    id: string,
    changes: { role?: UserRole; ativo?: boolean },
  ) {
    if (!session) return;
    try {
      await apiRequest(session.access_token, `/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setOperadores((users) =>
        users.map((user) => (user.id === id ? { ...user, ...changes } : user)),
      );
      setErro("");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a conta.",
      );
    }
  }

  async function confirmarAcao() {
    if (!session || !acaoPendente || aProcessarId) return;
    const { user, type } = acaoPendente;
    setAProcessarId(user.id);
    setErro("");
    try {
      if (type === "delete") {
        await apiRequest<void>(
          session.access_token,
          `/admin/users/${user.id}`,
          {
            method: "DELETE",
          },
        );
        setOperadores((users) => users.filter((entry) => entry.id !== user.id));
      } else {
        await apiRequest(session.access_token, `/admin/users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ativo: false }),
        });
        setOperadores((users) =>
          users.map((entry) =>
            entry.id === user.id ? { ...entry, ativo: false } : entry,
          ),
        );
      }
      setAcaoPendente(null);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação para esta conta.",
      );
    } finally {
      setAProcessarId(null);
    }
  }

  async function recuperar(id: string) {
    if (!session) return;
    try {
      const result = await apiRequest<{ message: string }>(
        session.access_token,
        `/admin/users/${id}/reset-access`,
        { method: "POST" },
      );
      setMensagemRecuperacao(result.message);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a recuperação.",
      );
    }
  }

  return (
    <AppLayout
      titulo="Utilizadores"
      subtitulo={`${operadores.length} contas`}
      allowedRoles={["admin"]}
    >
      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Operadores</h2>
          <Link
            to="/registo"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <UserPlus className="size-4" /> Registar operador
          </Link>
        </div>

        {erro ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {erro}
          </p>
        ) : null}
        {mensagemRecuperacao ? (
          <p role="status" className="mt-4 text-sm text-success">
            {mensagemRecuperacao}
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Nome</th>
                <th className="py-2 pr-3 font-medium">E-mail</th>
                <th className="py-2 pr-3 font-medium">Telefone</th>
                <th className="py-2 pr-3 font-medium">Função</th>
                <th className="py-2 pr-3 font-medium">Registado em</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {operadores.map((o) => (
                <tr key={o.id} className="border-b border-border/60">
                  <td className="py-3 pr-3 font-medium">{o.nome}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{o.email}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {o.telefone || "—"}
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={o.role}
                      onChange={(event) =>
                        void atualizar(o.id, {
                          role: event.target.value as UserRole,
                        })
                      }
                      className="rounded border border-input bg-background p-2"
                    >
                      <option value="operador">Operador</option>
                      <option value="admin">Admin/Técnico</option>
                      <option value="investigador">Investigador</option>
                    </select>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="py-3">{o.ativo ? "Ativa" : "Desativada"}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={o.ativo && o.id === profile?.id}
                        onClick={() =>
                          o.ativo
                            ? setAcaoPendente({ user: o, type: "deactivate" })
                            : void atualizar(o.id, { ativo: true })
                        }
                        title={
                          o.ativo && o.id === profile?.id
                            ? "Não podes desativar a tua própria conta"
                            : o.ativo
                              ? "Desativar conta"
                              : "Reativar conta"
                        }
                        aria-label={`${o.ativo ? "Desativar" : "Ativar"} conta de ${o.email}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-40"
                      >
                        {o.ativo ? (
                          <>
                            <UserX className="size-4" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-4" />
                            Reativar
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => void recuperar(o.id)}
                        aria-label={`Gerir acesso de ${o.email}`}
                        title="Gerir acesso"
                        className="text-primary"
                      >
                        <KeyRound className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={o.id === profile?.id}
                        onClick={() =>
                          setAcaoPendente({ user: o, type: "delete" })
                        }
                        aria-label={`Remover utilizador ${o.email}`}
                        title="Remover utilizador"
                        className="text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {operadores.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Ainda não existem contas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {acaoPendente ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            if (!aProcessarId) setAcaoPendente(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="user-action-title"
            aria-describedby="user-action-description"
            className="panel w-full max-w-md p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                {acaoPendente.type === "delete" ? (
                  <Trash2 className="size-5" />
                ) : (
                  <UserX className="size-5" />
                )}
              </div>
              <div>
                <h2 id="user-action-title" className="text-lg font-semibold">
                  {acaoPendente.type === "delete"
                    ? "Remover utilizador"
                    : "Desativar conta"}
                </h2>
                <p
                  id="user-action-description"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {acaoPendente.type === "delete"
                    ? `A conta de ${acaoPendente.user.nome} (${acaoPendente.user.email}) será removida permanentemente.`
                    : `A conta de ${acaoPendente.user.nome} será desativada e o utilizador ficará impedido de entrar no sistema.`}
                </p>
              </div>
            </div>
            {erro ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {erro}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={aProcessarId !== null}
                onClick={() => setAcaoPendente(null)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={aProcessarId !== null}
                onClick={() => void confirmarAcao()}
                className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {aProcessarId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : acaoPendente.type === "delete" ? (
                  <Trash2 className="size-4" />
                ) : (
                  <UserX className="size-4" />
                )}
                {aProcessarId
                  ? "A processar…"
                  : acaoPendente.type === "delete"
                    ? "Remover"
                    : "Desativar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}

type ManagedUser = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: UserRole;
  ativo: boolean;
  created_at: string;
};
