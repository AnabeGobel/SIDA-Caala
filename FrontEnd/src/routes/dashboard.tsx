import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Crosshair,
  Eye,
  Gauge,
  ImageIcon,
  Siren,
  Upload,
} from "lucide-react";
import { useCallback } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { alertasConfirmados, confirmarAlerta, useAnalises, useStore } from "@/lib/store";
import { porClasse, resumo, serieDiaria } from "@/lib/metrics";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de Detecções — ISPCAÁLA" },
      {
        name: "description",
        content:
          "Painel com análises reais, alertas guardados, confiança média e FPS calculados do banco de dados.",
      },
      { property: "og:title", content: "Dashboard de Detecções — ISPCAÁLA" },
      { property: "og:description", content: "Indicadores em tempo real das análises RX." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, session } = useAuth();
  const { analises, loading, error } = useAnalises(
    session?.access_token ?? null,
  );
  const [confirmados] = useStore(useCallback(() => alertasConfirmados(), []));

  const r = resumo(analises);
  const classes = porClasse(analises);
  const serie = serieDiaria(analises);
  const donut = [
    { nome: "Armas de Fogo", valor: r.fogo, cor: "var(--color-primary)" },
    { nome: "Armas Brancas", valor: r.branca, cor: "var(--color-destructive)" },
    { nome: "Ferramentas", valor: r.ferramenta, cor: "var(--color-chart-3)" },
    { nome: "Não classificado", valor: r.desconhecida, cor: "var(--color-muted)" },
  ];
  const totalDonut =
    r.fogo + r.branca + r.ferramenta + r.desconhecida || 1;
  const recentes = analises.slice(0, 6);
  const alertaActivo = analises.find((a) => a.alerta && !confirmados.includes(a.id));
  const detAlerta = alertaActivo?.deteccoes.find((d) => d.aceite);

  return (
    <AppLayout
      titulo="Dashboard"
      subtitulo={<>Bem-vindo(a), <span className="text-primary">{profile?.nome}</span></>}
      allowedRoles={["operador"]}
    >
      <div className="mb-5 flex justify-end">
        <Link
          to="/simulacao"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Upload className="size-4" />
          Simular agora
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icone={<ImageIcon className="size-7 text-primary-foreground" />}
          cor="info"
          titulo="Imagens Processadas"
          valor={String(r.totalImagens)}
          nota="Total de simulações"
        />
        <StatCard
          icone={<AlertTriangle className="size-7 text-destructive-foreground" />}
          cor="destructive"
          titulo="Alertas Gerados"
          valor={String(r.alertas)}
          nota="Com armas detectadas"
        />
        <StatCard
          icone={<Crosshair className="size-7 text-warning-foreground" />}
          cor="warning"
          titulo="Confiança Média"
          valor={`${r.confiancaMedia.toFixed(1)}%`}
          nota="Confiança média"
        />
        <StatCard
          icone={<Gauge className="size-7 text-success-foreground" />}
          cor="success"
          titulo="FPS Médio"
          valor={r.fpsMedio.toFixed(1)}
          nota="Processamento (FPS)"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Distribuição de Detecções por Classe</h2>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div className="h-52 w-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius="58%"
                      outerRadius="95%"
                      stroke="none"
                    >
                      {donut.map((d) => (
                        <Cell key={d.nome} fill={d.cor} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-3 text-sm">
                {donut.map((d) => (
                  <li key={d.nome} className="flex items-center gap-3">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: d.cor }}
                      aria-hidden
                    />
                    <span>
                      <span className="block font-medium">{d.nome}</span>
                      <span className="text-muted-foreground">
                        {Math.round((d.valor / totalDonut) * 100)}% ({d.valor})
                      </span>
                    </span>
                  </li>
                ))}
                <li className="pt-2 text-muted-foreground">
                  Total: {r.totalDeteccoes} detecções
                </li>
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {classes.map((c) => (
                <span
                  key={c.classe}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {c.classe}: {c.total}
                </span>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Resumo de Desempenho (últimos 7 dias)</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="dia" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="deteccoes"
                    name="Deteções"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="analises"
                    name="Análises"
                    stroke="var(--color-destructive)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Detecções Recentes</h2>
              <Link
                to="/historico"
                className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                Ver todas
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Imagem</th>
                    <th className="py-2 pr-3 font-medium">Classe Detectada</th>
                    <th className="py-2 pr-3 font-medium">Confiança</th>
                    <th className="py-2 pr-3 font-medium">Data/Hora</th>
                    <th className="py-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((a) => {
                    const d = a.deteccoes.find((x) => x.aceite);
                    const data = new Date(a.criadoEm);
                    return (
                      <tr key={a.id} className="border-b border-border/60">
                        <td className="py-3 pr-3 text-xs text-muted-foreground">{a.nomeImagem}</td>
                        <td className="py-3 pr-3">
                          <span
                            className={`rounded-md border px-2 py-1 text-xs ${
                              d
                                ? "border-destructive text-destructive"
                                : "border-success text-success"
                            }`}
                          >
                            {d ? d.classe : "Nenhum Objeto"}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-destructive">
                          {d ? `${(d.confianca * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {data.toLocaleDateString("pt-PT")} {data.toLocaleTimeString("pt-PT")}
                        </td>
                        <td className="py-3">
                          <Link
                            to="/historico"
                            aria-label="Ver detalhe"
                            className="text-primary hover:opacity-80"
                          >
                            <Eye className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Alertas Ativos</h2>
            {alertaActivo && detAlerta ? (
              <div className="alert-gradient mt-4 flex flex-wrap items-center gap-5 rounded-xl border border-destructive/50 p-5">
                <Siren className="size-12 shrink-0 text-destructive" />
                <div className="min-w-40 flex-1">
                  <p className="text-lg font-bold">Arma detectada!</p>
                  <p className="text-sm text-muted-foreground">Classe: {detAlerta.classe}</p>
                  <p className="text-sm text-muted-foreground">
                    Confiança: {(detAlerta.confianca * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-destructive">
                    {new Date(alertaActivo.criadoEm).toLocaleTimeString("pt-PT", {
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">Tempo do Alerta</p>
                  <button
                    onClick={() => confirmarAlerta(alertaActivo.id)}
                    className="mt-2 rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground"
                  >
                    Confirmar Alerta
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-border p-5 text-sm text-muted-foreground">
                Sem alertas pendentes. Todos os alertas foram confirmados.
              </p>
            )}
          </section>
        </div>
      </div>
      {loading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          A carregar dados reais do banco de dados…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Não foi possível carregar o dashboard: {error}
        </p>
      ) : null}
    </AppLayout>
  );
}
