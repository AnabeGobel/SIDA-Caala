import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { traduzirClasse } from "@/lib/detection";
import {
  formatFileSize,
  useResearchData,
  type ResearchModelsResponse,
} from "@/lib/research";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/modelos")({
  component: Modelos,
});

function Modelos() {
  const { session } = useAuth();
  const { data, loading, error } = useResearchData<ResearchModelsResponse>(
    "/research/models",
    session?.access_token ?? null,
  );

  return (
    <AppLayout
      titulo="Modelos"
      subtitulo="Checkpoints carregados pelo serviço de deteção"
      allowedRoles={["investigador"]}
    >
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />A consultar os checkpoints
          do backend…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          Não foi possível consultar os modelos: {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {data.models.map((model) => (
              <section key={model.filename} className="panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {model.name}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {model.filename}
                    </h2>
                  </div>
                  {model.loaded ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/40 px-2.5 py-1 text-xs text-success">
                      <CheckCircle2 className="size-3.5" />
                      Carregado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 px-2.5 py-1 text-xs text-warning">
                      <ShieldAlert className="size-3.5" />
                      Não carregado
                    </span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Tarefa</dt>
                    <dd className="font-medium">{model.task}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tamanho</dt>
                    <dd className="font-medium">
                      {formatFileSize(model.size_bytes)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Modificado</dt>
                    <dd className="font-medium">
                      {new Date(model.modified_at * 1000).toLocaleString(
                        "pt-PT",
                      )}
                    </dd>
                  </div>
                </dl>
                <h3 className="mt-5 border-t border-border pt-4 text-sm font-semibold">
                  Classes do checkpoint ({model.classes.length})
                </h3>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                  {model.classes.map((item) => (
                    <li
                      key={`${model.filename}-${item.id}`}
                      className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.id}
                      </span>
                      <span>{traduzirClasse(item.name)}</span>
                      <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                        {item.name}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>

          <section className="panel mt-5 p-5">
            <h2 className="text-lg font-semibold">Utilização na deteção</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Modelo principal ativo: <strong>{data.active_model}</strong>.
              Modelo complementar: <strong>{data.confirmation_model}</strong>.
              As classes acima e os IDs são lidos diretamente dos checkpoints em
              execução.
            </p>
          </section>
        </>
      ) : null}
    </AppLayout>
  );
}
