import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import rxLogin from "@/assets/rx-login.jpg";
import { fetchProfile, roleHome } from "@/lib/auth-core";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/lib/supabase";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Login — Sistema Inteligente de Detecção de Armas | ISPCAÁLA" },
      {
        name: "description",
        content:
          "Acesso de operadores ao sistema inteligente de detecção de armas em imagens de raio X do ISPCAÁLA.",
      },
      {
        property: "og:title",
        content: "Sistema Inteligente de Detecção de Armas — ISPCAÁLA",
      },
      {
        property: "og:description",
        content:
          "Autenticação de operadores para análise de imagens RX com YOLOv8.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [loginStatus, setLoginStatus] = useState<
    "" | "A verificar credenciais..." | "A carregar o sistema..."
  >("");

  useEffect(() => {
    if (profile) navigate({ to: roleHome(profile.role) });
  }, [navigate, profile]);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!supabase) return setErro("A autenticação ainda não está configurada.");
    setLoginStatus("A verificar credenciais...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) {
        setErro(error?.message ?? "Não foi possível iniciar sessão.");
        return;
      }

      setLoginStatus("A carregar o sistema...");
      const profile = await fetchProfile(data.session.access_token);
      navigate({ to: roleHome(profile.role) });
    } catch (profileError) {
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error(
          "Não foi possível terminar a sessão inválida.",
          signOutError,
        );
      }
      setErro(
        profileError instanceof Error
          ? profileError.message
          : "A conta não tem um perfil autorizado.",
      );
    } finally {
      setLoginStatus("");
    }
  }

  async function recuperarAcesso() {
    setErro("");
    if (!supabase) return setErro("A autenticação ainda não está configurada.");
    if (!email.trim())
      return setErro(
        "Introduza o seu e-mail para receber a ligação de recuperação.",
      );
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setErro(
      error?.message ??
        "Se a conta existir, receberá uma ligação para redefinir a palavra-passe.",
    );
  }

  return (
    <div className="relative grid min-h-screen bg-background lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggleButton />
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex size-12 items-center justify-center rounded-xl">
              <ShieldCheck className="size-7 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-bold tracking-wide">
                SISTEMA INTELIGENTE
                <br />
                DE DETECÇÃO DE ARMAS
              </p>
              <p className="text-sm font-bold text-primary">ISPCAÁLA</p>
            </div>
          </div>

          <h1 className="mt-10 text-3xl font-bold tracking-tight">
            Iniciar sessão
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesso reservado a operadores autorizados.
          </p>

          <form onSubmit={submeter} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                E-mail
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-card px-3">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none"
                  placeholder="operador@ispcaala.ao"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium">
                Palavra-passe
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-input bg-card px-3">
                <Lock className="size-4 text-muted-foreground" />
                <input
                  id="password"
                  type={ver ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-label={
                    ver ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
                  }
                  aria-pressed={ver}
                  title={
                    ver ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
                  }
                  className="text-muted-foreground"
                >
                  {ver ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

            <button
              type="submit"
              disabled={Boolean(loginStatus)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-75"
            >
              {loginStatus ? (
                <>
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  {loginStatus}
                </>
              ) : (
                "Entrar"
              )}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => void recuperarAcesso()}
                className="text-muted-foreground hover:text-foreground"
              >
                Esqueceu a palavra-passe?
              </button>
              <span className="text-muted-foreground">
                Acesso criado pelo administrador
              </span>
            </div>
          </form>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            © 2026 ISPCAÁLA — Instituto Superior Politécnico de Caála
          </p>
        </div>
      </div>

      <div className="relative hidden items-center justify-center bg-sidebar p-10 lg:flex">
        <img
          src={rxLogin}
          alt="Imagem de raio X de bagagem com arma detectada"
          width={1024}
          height={1280}
          className="max-h-[80vh] w-auto rounded-2xl border border-border object-cover"
        />
      </div>
    </div>
  );
}
