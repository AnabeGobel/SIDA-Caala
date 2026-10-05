import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { porClasse } from "@/lib/metrics";
import { useAnalises } from "@/lib/store";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/metricas")({
  head: () => ({
    meta: [
      { title: "Métricas Reais das Análises | ISPCAÁLA" },
      {
        name: "description",
        content:
          "Volume de análises, deteções, confiança média e tempos de inferência registados no banco de dados.",
      },
      {
        property: "og:title",
        content: "Métricas Reais das Análises — ISPCAÁLA",
      },
      {
        property: "og:description",
        content: "Indicadores calculados a partir das análises persistidas.",
      },
    ],
  }),
  component: Metricas,
});

function Metricas() {
  const { session } = useAuth();
  const { analises, loading, error } = useAnalises(
    session?.access_token ?? null,
  );
  const classes = porClasse(analises);
  const deteccoes = analises.flatMap((analise) =>
    analise.deteccoes.filter((detection) => detection.aceite),
  );
  const confiancaMedia = deteccoes.length
    ? (deteccoes.reduce((sum, detection) => sum + detection.confianca, 0) /
        deteccoes.length) *
      100
    : 0;
  const tempoMedio = analises.length
    ? analises.reduce((sum, analise) => sum + analise.tempoMs, 0) /
      analises.length
    : 0;
  const fpsMedio = analises.length
    ? analises.reduce((sum, analise) => sum + analise.fps, 0) / analises.length
    : 0;

  const cartoes = [
    { nome: "Imagens analisadas", valor: String(analises.length) },
    { nome: "Deteções aceites", valor: String(deteccoes.length) },
    { nome: "Confiança média", valor: `${confiancaMedia.toFixed(1)}%` },
    { nome: "Tempo médio de inferência", valor: `${tempoMedio.toFixed(0)} ms` },
    { nome: "FPS médio", valor: fpsMedio.toFixed(1) },
  ];

  return (
    <AppLayout
      titulo="Métricas de Desempenho"
      subtitulo="Indicadores calculados a partir das análises guardadas"
      allowedRoles={["admin", "investigador"]}
    >
      {loading ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          A carregar métricas do banco de dados…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Não foi possível carregar as métricas: {error}
        </p>
      ) : null}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cartoes.map((c) => (
          <div key={c.nome} className="panel p-4">
            <p className="text-sm text-muted-foreground">{c.nome}</p>
            <p className="mt-1 truncate text-2xl font-bold">{c.valor}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="panel min-w-0 p-5">
          <h2 className="text-lg font-semibold">Detecções por classe</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classes}>
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="classe"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Detecções"
                  fill="var(--color-primary)"
                  radius={6}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel min-w-0 p-5">
          <h2 className="text-lg font-semibold">Totais reais por classe</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="py-2 font-medium">Classe</th>
                <th className="py-2 text-right font-medium">
                  Deteções aceites
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map((item) => (
                <tr key={item.classe} className="border-b border-border/60">
                  <td className="py-3">{item.classe}</td>
                  <td className="py-3 text-right font-semibold">
                    {item.total}
                  </td>
                </tr>
              ))}
              {classes.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="py-4 text-center text-muted-foreground"
                  >
                    Ainda não há deteções guardadas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            Precisão, recall, F1 e mAP não são calculados sem rótulos de
            referência validados para cada imagem.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
