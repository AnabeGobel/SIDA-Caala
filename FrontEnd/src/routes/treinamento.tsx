import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  useResearchData,
  type ResearchDatasetResponse,
  type ResearchModelsResponse,
} from "@/lib/research";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/treinamento")({
  component: Treinamento,
});

function Treinamento() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const models = useResearchData<ResearchModelsResponse>(
    "/research/models",
    accessToken,
  );
  const dataset = useResearchData<ResearchDatasetResponse>(
    "/research/dataset",
    accessToken,
  );
  const loading = models.loading || dataset.loading;
  const error = models.error ?? dataset.error;
  const canPrepareTraining =
    Boolean(dataset.data?.annotation_ready) &&
    Boolean(dataset.data?.splits.train) &&
    Boolean(dataset.data?.splits.validation);

  return (
    <AppLayout
      titulo="Treinamento"
      subtitulo="Estado dos artefactos e requisitos para iniciar uma experiência"
      allowedRoles={["investigador"]}
    >
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />A verificar pesos e dados…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          Não foi possível consultar o estado de treino: {error}
        </p>
      ) : null}

      {models.data && dataset.data ? (
        <>
          <section
            className={`panel flex items-start gap-3 border p-5 ${
              canPrepareTraining ? "border-success/40" : "border-warning/40"
            }`}
          >
            {canPrepareTraining ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            )}
            <div>
              <h2 className="font-semibold">
                {canPrepareTraining
                  ? "Dataset anotado disponível"
                  : "Treino não pode ser iniciado neste ambiente"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {canPrepareTraining
                  ? "Há anotações e divisões de treino/validação, mas o backend ainda não dispõe de uma fila nem de uma API para iniciar e acompanhar trabalhos de treino."
                  : "As imagens disponíveis não têm anotações YOLO confirmadas nem divisões train/validation. Não existe neste backend um pipeline de treino nem um gestor de trabalhos."}
              </p>
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="panel p-5">
              <h2 className="text-lg font-semibold">
                Pesos atualmente disponíveis
              </h2>
              <ul className="mt-4 space-y-3">
                {models.data.models.map((model) => (
                  <li
                    key={model.filename}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <span>
                      <span className="block font-medium">
                        {model.filename}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {model.classes.length} classes · {model.task}
                      </span>
                    </span>
                    <span className="text-xs text-success">
                      {model.loaded ? "Carregado" : "Não carregado"}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/modelos"
                className="mt-4 inline-flex text-sm text-primary hover:underline"
              >
                Consultar classes e versões
              </Link>
            </section>

            <section className="panel p-5">
              <h2 className="text-lg font-semibold">
                O que falta para treinar
              </h2>
              <ol className="mt-4 list-inside list-decimal space-y-3 text-sm text-muted-foreground">
                <li>Adicionar as imagens de treino e validação.</li>
                <li>Fornecer anotações YOLO (ficheiro `.txt` por imagem).</li>
                <li>
                  Criar um `data.yaml` com nomes e IDs de classes consistentes.
                </li>
                <li>
                  Configurar execução, registo de progresso e cancelamento.
                </li>
                <li>
                  Avaliar o novo checkpoint antes de o ativar em produção.
                </li>
              </ol>
              <Link
                to="/datasets"
                className="mt-4 inline-flex text-sm text-primary hover:underline"
              >
                Ver inventário do dataset
              </Link>
            </section>
          </div>
        </>
      ) : null}
    </AppLayout>
  );
}
