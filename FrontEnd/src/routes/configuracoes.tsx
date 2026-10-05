import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Moon, Save, Sun } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppLayout } from "@/components/AppLayout";
import { apiRequest } from "@/lib/auth-core";
import type { UserProfile } from "@/lib/auth-core";
import { CLASSES } from "@/lib/detection";
import { getConfig, setConfig, useStore } from "@/lib/store";
import { useAuth } from "@/lib/use-auth";
import type { Theme } from "@/lib/theme-context";
import { useTheme } from "@/lib/use-theme";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do Sistema — ISPCAÁLA" },
      {
        name: "description",
        content:
          "Definir limiar de confiança, modelo YOLOv8 e preferências de alerta do sistema.",
      },
      { property: "og:title", content: "Configurações do Sistema — ISPCAÁLA" },
      {
        property: "og:description",
        content: "Parâmetros de inferência e alertas.",
      },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { session, profile, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [config, refresh] = useStore(useCallback(() => getConfig(), []));
  const [local, setLocal] = useState(config);
  const [gravado, setGravado] = useState(false);
  const [perfilForm, setPerfilForm] = useState({
    nome: profile?.nome ?? "",
    email: profile?.email ?? "",
    telefone: profile?.telefone ?? "",
  });
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setPerfilForm({
      nome: profile.nome,
      email: profile.email,
      telefone: profile.telefone ?? "",
    });
  }, [profile]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !profile) return;
    setProfileError(null);
    setProfileSaved(false);
    if (password && password !== passwordConfirmation) {
      setProfileError("A palavra-passe e a confirmação não coincidem.");
      return;
    }
    if (!password && passwordConfirmation) {
      setProfileError("Introduza uma palavra-passe antes de a confirmar.");
      return;
    }
    if (password && password.length < 8) {
      setProfileError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }

    const changes: {
      nome: string;
      email: string;
      telefone: string | null;
      password?: string;
      password_confirmation?: string;
    } = {
      nome: perfilForm.nome.trim(),
      email: perfilForm.email.trim(),
      telefone: perfilForm.telefone.trim() || null,
    };
    if (password) {
      changes.password = password;
      changes.password_confirmation = passwordConfirmation;
    }

    setSavingProfile(true);
    try {
      const updated = await apiRequest<UserProfile>(
        session.access_token,
        "/auth/profile",
        { method: "PATCH", body: JSON.stringify(changes) },
      );
      updateProfile(updated);
      setPassword("");
      setPasswordConfirmation("");
      setProfileSaved(true);
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar os dados da conta.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <AppLayout
      titulo="Configurações"
      subtitulo="Dados pessoais e preferências do sistema"
      allowedRoles={["admin", "operador", "investigador"]}
    >
      <div className="space-y-4">
        <section className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Aparência</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolhe o modo de fundo. A preferência fica guardada neste
              navegador.
            </p>
          </div>
          <div
            className="grid shrink-0 grid-cols-2 gap-2 sm:w-auto"
            role="group"
            aria-label="Modo de aparência"
          >
            {(
              [
                { value: "light", label: "Claro (padrão)", Icon: Sun },
                { value: "dark", label: "Escuro", Icon: Moon },
              ] satisfies { value: Theme; label: string; Icon: typeof Sun }[]
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  theme === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <section className="panel p-5 lg:col-span-7">
            <h2 className="text-lg font-semibold">Dados da conta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Atualiza o teu nome, e-mail, telefone de contacto ou
              palavra-passe.
            </p>
            <form
              onSubmit={(event) => void saveProfile(event)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <label className="block text-sm font-medium">
                Nome completo
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={perfilForm.nome}
                  onChange={(event) =>
                    setPerfilForm({ ...perfilForm, nome: event.target.value })
                  }
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 font-normal"
                />
              </label>
              <label className="block text-sm font-medium">
                E-mail
                <input
                  required
                  type="email"
                  value={perfilForm.email}
                  onChange={(event) =>
                    setPerfilForm({ ...perfilForm, email: event.target.value })
                  }
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 font-normal"
                />
              </label>
              <label className="block text-sm font-medium">
                Número de telefone
                <input
                  type="tel"
                  maxLength={32}
                  value={perfilForm.telefone}
                  onChange={(event) =>
                    setPerfilForm({
                      ...perfilForm,
                      telefone: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 font-normal"
                  placeholder="+244 900 000 000"
                />
              </label>
              <label className="block text-sm font-medium">
                Nova palavra-passe
                <span className="mt-2 flex items-center rounded-lg border border-input bg-background px-3">
                  <input
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full bg-transparent py-2.5 font-normal outline-none"
                    placeholder="Deixa em branco para manter a atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword
                        ? "Ocultar palavra-passe"
                        : "Mostrar palavra-passe"
                    }
                    title={
                      showPassword
                        ? "Ocultar palavra-passe"
                        : "Mostrar palavra-passe"
                    }
                    className="text-muted-foreground"
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
                Confirmar nova palavra-passe
                <span className="mt-2 flex items-center rounded-lg border border-input bg-background px-3">
                  <input
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    className="w-full bg-transparent py-2.5 font-normal outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword
                        ? "Ocultar confirmação da palavra-passe"
                        : "Mostrar confirmação da palavra-passe"
                    }
                    title={
                      showPassword
                        ? "Ocultar confirmação da palavra-passe"
                        : "Mostrar confirmação da palavra-passe"
                    }
                    className="text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </span>
              </label>
              {profileError ? (
                <p
                  role="alert"
                  className="text-sm text-destructive sm:col-span-2"
                >
                  {profileError}
                </p>
              ) : null}
              {profileSaved ? (
                <p role="status" className="text-sm text-success sm:col-span-2">
                  Dados da conta atualizados.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
              >
                {savingProfile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Guardar dados da conta
              </button>
            </form>
          </section>

          <div className="space-y-4 lg:col-span-5">
            {profile?.role === "admin" ? (
              <section className="panel p-5">
                <h2 className="text-lg font-semibold">Inferência</h2>

                <label className="mt-5 flex items-center justify-between text-sm font-medium">
                  Limiar de confiança
                  <span className="text-primary">
                    {local.limiar.toFixed(2)}
                  </span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.01}
                  value={local.limiar}
                  onChange={(e) =>
                    setLocal({ ...local, limiar: Number(e.target.value) })
                  }
                  className="mt-3 w-full accent-[var(--color-primary)]"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Detecções com confiança inferior ao limiar são descartadas
                  (RF04).
                </p>

                <label className="mt-6 block text-sm font-medium">Modelo</label>
                <select
                  value={local.modelo}
                  onChange={(e) =>
                    setLocal({ ...local, modelo: e.target.value })
                  }
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none [&>option]:bg-card"
                >
                  <option>YOLOv8n (640×640)</option>
                  <option>YOLOv8s (640×640)</option>
                  <option>YOLOv8m (640×640)</option>
                </select>

                <label className="mt-6 flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={local.alertaSonoro}
                    onChange={(e) =>
                      setLocal({ ...local, alertaSonoro: e.target.checked })
                    }
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  Alerta visual e sonoro em detecções válidas
                </label>

                <button
                  onClick={() => {
                    setConfig(local);
                    refresh();
                    setGravado(true);
                    setTimeout(() => setGravado(false), 2000);
                  }}
                  className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  Guardar configurações
                </button>
                {gravado ? (
                  <p className="mt-2 text-sm text-success">
                    Configurações guardadas.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="panel p-5">
              <h2 className="text-lg font-semibold">
                Classes anotadas no conjunto de dados
              </h2>
              <ul className="mt-4 space-y-2 text-sm">
                {CLASSES.map((c) => (
                  <li
                    key={c}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <span>{c}</span>
                    <span className="text-xs text-muted-foreground">
                      activa
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Pré-processamento fixo: redimensionamento 640×640, normalização
                [0,1] e conversão para tensor RGB (RF02).
              </p>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
