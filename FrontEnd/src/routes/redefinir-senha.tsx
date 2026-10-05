import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Redefinir palavra-passe — ISPCAÁLA" }] }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8)
      return setMessage("A palavra-passe deve ter pelo menos 8 caracteres.");
    if (password !== confirmation)
      return setMessage("As palavras-passe não coincidem.");
    if (!supabase)
      return setMessage("A autenticação ainda não está configurada.");

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMessage(error.message);
    await supabase.auth.signOut();
    setMessage("Palavra-passe atualizada. Já pode iniciar sessão.");
    window.setTimeout(() => navigate({ to: "/" }), 1200);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-5">
      <div className="absolute right-4 top-4">
        <ThemeToggleButton />
      </div>
      <form onSubmit={submit} className="panel w-full max-w-md space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold">Redefinir palavra-passe</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Defina uma nova palavra-passe para a sua conta.
          </p>
        </div>
        <label className="block text-sm font-medium">
          Nova palavra-passe
          <span className="relative mt-2 block">
            <input
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={
                showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
              }
              aria-pressed={showPassword}
              title={
                showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </span>
        </label>
        <label className="block text-sm font-medium">
          Confirmar palavra-passe
          <span className="relative mt-2 block">
            <input
              required
              minLength={8}
              type={showConfirmation ? "text" : "password"}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowConfirmation((visible) => !visible)}
              aria-label={
                showConfirmation ? "Ocultar confirmação" : "Mostrar confirmação"
              }
              aria-pressed={showConfirmation}
              title={
                showConfirmation ? "Ocultar confirmação" : "Mostrar confirmação"
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showConfirmation ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </span>
        </label>
        {message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
        <button
          disabled={saving}
          className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "A guardar…" : "Guardar nova palavra-passe"}
        </button>
      </form>
    </main>
  );
}
