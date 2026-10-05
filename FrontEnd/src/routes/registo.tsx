import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mail, User, UserPlus } from "lucide-react";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { apiRequest, type UserRole } from "@/lib/auth-core";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/registo")({
  head: () => ({
    meta: [
      { title: "Registo de Operador — Detecção de Armas | ISPCAÁLA" },
      {
        name: "description",
        content: "Criação de conta de operador para o sistema de detecção de armas em imagens RX.",
      },
      { property: "og:title", content: "Registo de Operador — ISPCAÁLA" },
      { property: "og:description", content: "Criar conta de operador do sistema de detecção." },
    ],
  }),
  component: RegistoPage,
});

function RegistoPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    role: "operador" as UserRole,
  });
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!session) return;
    setAEnviar(true);
    try {
      await apiRequest(session.access_token, "/admin/users", {
        method: "POST",
        body: JSON.stringify({ nome: form.nome.trim(), email: form.email.trim(), role: form.role }),
      });
      setOk(true);
      window.setTimeout(() => navigate({ to: "/utilizadores" }), 1600);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar o convite.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <AppLayout
      titulo="Criar utilizador"
      subtitulo="O convite segue para o e-mail informado; a pessoa define a própria palavra-passe."
      allowedRoles={["admin"]}
    >
      <section className="panel max-w-2xl p-5">
        <form onSubmit={submeter} className="space-y-5">
          <label className="block text-sm font-medium">
            Nome completo
            <span className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-background px-3">
              <User className="size-4 text-muted-foreground" />
              <input required minLength={2} maxLength={120} value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} className="w-full bg-transparent py-3 outline-none" />
            </span>
          </label>
          <label className="block text-sm font-medium">
            E-mail institucional
            <span className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-background px-3">
              <Mail className="size-4 text-muted-foreground" />
              <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full bg-transparent py-3 outline-none" />
            </span>
          </label>
          <label className="block text-sm font-medium">
            Função
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })} className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-3">
              <option value="operador">Operador de Segurança</option>
              <option value="admin">Administrador/Técnico</option>
              <option value="investigador">Investigador</option>
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            O utilizador receberá uma ligação no e-mail acima para criar a palavra-passe. Não é
            enviada nem guardada uma palavra-passe temporária.
          </p>
          {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}
          {ok ? (
            <p role="status" className="text-sm text-success">
              Convite enviado para {form.email}. Se não aparecer, peça ao utilizador para verificar
              também a pasta de spam.
            </p>
          ) : null}
          <button type="submit" disabled={aEnviar} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <UserPlus className="size-4" />
            {aEnviar ? "A enviar convite…" : "Enviar convite"}
          </button>
        </form>
      </section>
    </AppLayout>
  );
}
