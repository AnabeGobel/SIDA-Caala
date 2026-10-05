import { Link } from "@tanstack/react-router";
import { AlertTriangle, Crosshair, ImageIcon, Upload } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { porClasse, resumo } from "@/lib/metrics";
import { useAnalises } from "@/lib/store";
import { useAuth } from "@/lib/use-auth";
import type { UserRole } from "@/lib/auth-core";

export function AnalysisDashboard({
  title,
  subtitle,
  role,
}: {
  title: string;
  subtitle: string;
  role: UserRole;
}) {
  const { session } = useAuth();
  const { analises, loading, error } = useAnalises(
    session?.access_token ?? null,
  );
  const totals = resumo(analises);
  const classes = porClasse(analises);
  const recentes = analises.slice(0, 8);

  return (
    <AppLayout titulo={title} subtitulo={subtitle} allowedRoles={[role]}>
      <div className="mb-5 flex flex-wrap justify-end gap-3">
        <Link
          to="/historico"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent"
        >
          Consultar histórico
        </Link>
        <Link
          to="/metricas"
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent"
        >
          Ver métricas
        </Link>
        <Link
          to="/simulacao"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Upload className="size-4" />
          Nova análise
        </Link>
      </div>

      {loading ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          A carregar dados reais do banco de dados…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          Não foi possível carregar o dashboard: {error}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icone={<ImageIcon className="size-7 text-primary-foreground" />}
          cor="info"
          titulo="Imagens analisadas"
          valor={String(totals.totalImagens)}
          nota="Registos guardados"
        />
        <StatCard
          icone={<Crosshair className="size-7 text-warning-foreground" />}
          cor="warning"
          titulo="Deteções aceites"
          valor={String(totals.totalDeteccoes)}
          nota={`${totals.confiancaMedia.toFixed(1)}% de confiança média`}
        />
        <StatCard
          icone={
            <AlertTriangle className="size-7 text-destructive-foreground" />
          }
          cor="destructive"
          titulo="Análises com alerta"
          valor={String(totals.alertas)}
          nota="Calculado a partir das deteções guardadas"
        />
        <StatCard
          icone={<Crosshair className="size-7 text-success-foreground" />}
          cor="success"
          titulo="Tempo médio"
          valor={
            analises.length
              ? `${(
                  analises.reduce(
                    (sum, analysis) => sum + analysis.tempoMs,
                    0,
                  ) / analises.length
                ).toFixed(0)} ms`
              : "0 ms"
          }
          nota="Inferência do modelo"
        />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="panel min-w-0 p-5">
          <h2 className="text-lg font-semibold">Deteções reais por classe</h2>
          <ul className="mt-4 space-y-2">
            {classes.map((item) => (
              <li
                key={item.classe}
                className="flex justify-between border-b border-border/60 py-2 text-sm"
              >
                <span>{item.classe}</span>
                <span className="font-semibold">{item.total}</span>
              </li>
            ))}
            {classes.length === 0 ? (
              <li className="py-4 text-sm text-muted-foreground">
                Ainda não existem deteções guardadas.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="panel min-w-0 p-5">
          <h2 className="text-lg font-semibold">Análises recentes</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Data / Hora</th>
                  <th className="py-2 pr-3 font-medium">Imagem</th>
                  <th className="py-2 font-medium">Classes</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((analysis) => (
                  <tr key={analysis.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-muted-foreground">
                      {new Date(analysis.criadoEm).toLocaleString("pt-PT")}
                    </td>
                    <td className="py-2 pr-3">{analysis.nomeImagem}</td>
                    <td className="py-2">
                      {analysis.deteccoes
                        .filter((detection) => detection.aceite)
                        .map((detection) => detection.classe)
                        .join(", ") || "Nenhuma"}
                    </td>
                  </tr>
                ))}
                {!loading && recentes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-4 text-center text-muted-foreground"
                    >
                      Ainda não existem análises guardadas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
