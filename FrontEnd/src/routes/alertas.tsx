import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAnalises } from "@/lib/store";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/alertas")({
  head: () => ({
    meta: [{ title: "Alertas de Deteção — ISPCAÁLA" }],
  }),
  component: Alertas,
});

function Alertas() {
  const { session } = useAuth();
  const { analises, loading, error } = useAnalises(
    session?.access_token ?? null,
  );
  const alertas = analises.filter((analise) => analise.alerta);

  return (
    <AppLayout
      titulo="Alertas"
      subtitulo="Análises com deteções aceites guardadas no banco de dados"
      allowedRoles={["operador"]}
    >
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          A carregar alertas…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar os alertas: {error}
        </p>
      ) : null}

      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Alertas reais</h2>
            <p className="text-sm text-muted-foreground">
              {alertas.length} análises com deteções acima do limiar definido
            </p>
          </div>
          <Link
            to="/historico"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Abrir histórico
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {alertas.map((analise) => (
            <article
              key={analise.id}
              className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold">{analise.nomeImagem}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(analise.criadoEm).toLocaleString("pt-PT")}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {analise.deteccoes
                      .filter((deteccao) => deteccao.aceite)
                      .map((deteccao, index) => (
                        <li
                          key={`${analise.id}-${index}`}
                          className="rounded-md bg-destructive/10 px-2 py-1 text-xs"
                        >
                          {deteccao.classe} ·{" "}
                          {(deteccao.confianca * 100).toFixed(1)}%
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
              <span className="text-xs text-warning">Requer verificação humana</span>
            </article>
          ))}
          {!loading && !error && alertas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Não há alertas guardados.
            </p>
          ) : null}
        </div>
      </section>
    </AppLayout>
  );
}
