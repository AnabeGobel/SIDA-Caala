import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronDown,
  Clock,
  Cpu,
  Gauge,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { roleHome, type UserRole } from "@/lib/auth-core";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/lib/supabase";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

const NAV = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["operador"],
  },
  {
    to: "/dashboard-admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    to: "/simulacao",
    label: "Nova análise",
    icon: Upload,
    roles: ["operador", "admin", "investigador"],
  },
  { to: "/alertas", label: "Alertas", icon: ShieldCheck, roles: ["operador"] },
  {
    to: "/historico",
    label: "Histórico",
    icon: Clock,
    roles: ["operador", "admin", "investigador"],
  },
  {
    to: "/metricas",
    label: "Métricas",
    icon: BarChart3,
    roles: ["admin", "investigador"],
  },
  { to: "/utilizadores", label: "Utilizadores", icon: Users, roles: ["admin"] },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    roles: ["operador", "admin", "investigador"],
  },
  {
    to: "/monitorizacao",
    label: "Monitorização",
    icon: Gauge,
    roles: ["admin"],
  },
  { to: "/sistema", label: "Sistema", icon: ShieldCheck, roles: ["admin"] },
  {
    to: "/datasets",
    label: "Datasets",
    icon: ImageIcon,
    roles: ["investigador"],
  },
  {
    to: "/treinamento",
    label: "Treinamento",
    icon: Play,
    roles: ["investigador"],
  },
  { to: "/modelos", label: "Modelos", icon: Cpu, roles: ["investigador"] },
  {
    to: "/avaliacao",
    label: "Avaliação",
    icon: Gauge,
    roles: ["investigador"],
  },
] as const;

export function AppLayout({
  titulo,
  subtitulo,
  children,
  allowedRoles = ["operador", "admin", "investigador"],
}: {
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [aberto, setAberto] = useState(true);
  const [agora, setAgora] = useState<Date | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const atualizarRelogio = () => setAgora(new Date());
    atualizarRelogio();

    let cleanupIntervalo = () => {};
    const ateProximoMinuto = 60_000 - (Date.now() % 60_000);
    const alinhamento = window.setTimeout(() => {
      atualizarRelogio();
      const intervalo = window.setInterval(atualizarRelogio, 60_000);
      cleanupIntervalo = () => window.clearInterval(intervalo);
    }, ateProximoMinuto);

    return () => {
      window.clearTimeout(alinhamento);
      cleanupIntervalo();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session || !profile) {
      navigate({ to: "/" });
      return;
    }
    if (!allowedRoles.includes(profile.role))
      navigate({ to: roleHome(profile.role) });
  }, [allowedRoles, loading, navigate, profile, session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        A validar sessão…
      </div>
    );
  }
  if (!session || !profile || !allowedRoles.includes(profile.role)) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        id="app-navigation"
        aria-hidden={!aberto}
        inert={!aberto}
        className={`${aberto ? "translate-x-0 md:w-72" : "-translate-x-full md:w-0 md:translate-x-0"} fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar transition-all duration-200 md:static md:z-auto md:overflow-hidden`}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="brand-gradient flex size-11 items-center justify-center rounded-xl">
            <ShieldCheck className="size-6 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-bold tracking-wide text-sidebar-foreground">
              SISTEMA INTELIGENTE
              <br />
              DE DETECÇÃO DE ARMAS
            </p>
            <p className="mt-1 text-sm font-bold text-primary">ISPCAÁLA</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.filter((item) =>
            item.roles.some((role) => role === profile.role),
          ).map(({ to, label, icon: Icon }) => {
            const activo = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setAberto(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  activo
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              setAberto(false);
              void supabase?.auth.signOut().then(() => navigate({ to: "/" }));
            }}
            className="mt-1 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="size-5" />
            Sair
          </button>
        </nav>

        <div className="p-4">
          <div className="flex items-start gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
            <ShieldCheck className="size-6 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              Segurança Inteligente para um ambiente mais seguro.
            </p>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            © 2026 ISPCAÁLA
          </p>
        </div>
      </aside>
      {aberto ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <button
            onClick={() => setAberto((v) => !v)}
            aria-label="Alternar menu"
            aria-expanded={aberto}
            aria-controls="app-navigation"
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <ThemeToggleButton />
            <div className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-accent sm:flex">
              <Users className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="max-w-32 truncate text-sm font-semibold md:max-w-48">
                {profile.nome}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile.role}
              </p>
            </div>
            <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6 md:gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {titulo}
                </h1>
                {subtitulo ? (
                  <div className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    {subtitulo}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground md:text-sm">
                <span className="flex items-center gap-2">
                  <Gauge className="size-4" />
                  {agora?.toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }) ?? "—"}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="size-4" />
                  {agora?.toLocaleTimeString("pt-PT") ?? "—"}
                </span>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
