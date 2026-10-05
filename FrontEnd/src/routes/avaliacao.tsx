import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { traduzirClasse } from "@/lib/detection";
import { apiRequest } from "@/lib/auth-core";
import type { ResearchEvaluationResponse } from "@/lib/research";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/avaliacao")({
  component: Avaliacao,
});

function Avaliacao() {
  const { session } = useAuth();
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.2);
  const [result, setResult] = useState<ResearchEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runEvaluation() {
    if (!session?.access_token) {
      setError("A sessão expirou. Inicia sessão novamente.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiRequest<ResearchEvaluationResponse>(
        session.access_token,
        "/research/evaluate",
        {
          method: "POST",
          body: JSON.stringify({
            confidence_threshold: confidenceThreshold,
          }),
        },
      );
      setResult(response);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível executar a avaliação.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout
      titulo="Avaliação"
      subtitulo="Inferência exploratória nos ficheiros locais disponíveis"
      allowedRoles={["investigador"]}
    >
      <section className="panel p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Executar avaliação exploratória
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Executa o pipeline ativo nos exemplos locais e apresenta classes,
              confiança e tempo real de inferência. Como estas imagens não têm
              rótulos de referência verificados, o resultado não mede acurácia.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">
                Confiança mínima
              </span>
              <input
                type="number"
                min={0.01}
                max={0.99}
                step={0.01}
                value={confidenceThreshold}
                onChange={(event) =>
                  setConfidenceThreshold(Number(event.target.value))
                }
                className="w-28 rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={() => void runEvaluation()}
              disabled={
                loading ||
                confidenceThreshold < 0.01 ||
                confidenceThreshold > 0.99
              }
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {loading ? "A avaliar…" : "Executar"}
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      {result ? (
        <>
          <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Imagens executadas",
                `${result.evaluated_count}/${result.image_count}`,
              ],
              ["Deteções", String(result.total_detections)],
              ["Tempo médio por imagem", `${result.mean_inference_ms} ms`],
              ["Confiança mínima", result.confidence_threshold.toFixed(2)],
            ].map(([label, value]) => (
              <div key={label} className="panel p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          <section className="panel mt-5 flex items-start gap-3 border border-warning/40 p-5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <h2 className="font-semibold">
                Avaliação exploratória, não métrica de acurácia
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.metrics_note}
              </p>
              {result.truncated ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  O conjunto foi limitado às primeiras 200 imagens.
                </p>
              ) : null}
              {result.skipped_count ? (
                <p className="mt-1 text-sm text-destructive">
                  {result.skipped_count} imagens não puderam ser processadas.
                </p>
              ) : null}
            </div>
          </section>

          <section className="panel mt-5 p-5">
            <h2 className="text-lg font-semibold">Deteções por classe</h2>
            {Object.keys(result.class_counts).length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {Object.entries(result.class_counts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([className, count]) => (
                    <li
                      key={className}
                      className="rounded-full border border-border px-3 py-1.5 text-sm"
                    >
                      {traduzirClasse(className)}: {count}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma deteção acima do limiar escolhido.
              </p>
            )}
          </section>

          <section className="panel mt-5 p-5">
            <h2 className="text-lg font-semibold">Resultado por imagem</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Imagem</th>
                    <th className="py-2 pr-3 font-medium">Dimensões</th>
                    <th className="py-2 pr-3 font-medium">Tempo</th>
                    <th className="py-2 font-medium">Deteções</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((image) => (
                    <tr
                      key={image.filename}
                      className="border-b border-border/60"
                    >
                      <td className="py-3 pr-3">{image.filename}</td>
                      <td className="py-3 pr-3">
                        {image.width} × {image.height}
                      </td>
                      <td className="py-3 pr-3">{image.inference_ms} ms</td>
                      <td className="py-3">
                        {image.detections.length
                          ? image.detections
                              .map(
                                (detection) =>
                                  `${traduzirClasse(detection.class_name)} (${(
                                    detection.confidence * 100
                                  ).toFixed(1)}%)`,
                              )
                              .join(", ")
                          : "Nenhuma"}
                      </td>
                    </tr>
                  ))}
                  {result.errors.map((item) => (
                    <tr
                      key={`error-${item.filename}`}
                      className="border-b border-destructive/20"
                    >
                      <td className="py-3 pr-3">{item.filename}</td>
                      <td colSpan={3} className="py-3 text-destructive">
                        {item.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </AppLayout>
  );
}
