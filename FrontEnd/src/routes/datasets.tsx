import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  formatFileSize,
  useResearchData,
  type ResearchDatasetResponse,
} from "@/lib/research";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/datasets")({
  component: Datasets,
});

function Datasets() {
  const { session } = useAuth();
  const { data, loading, error } = useResearchData<ResearchDatasetResponse>(
    "/research/dataset",
    session?.access_token ?? null,
  );

  return (
    <AppLayout
      titulo="Datasets"
      subtitulo="Inspeção dos ficheiros de imagem disponíveis no backend"
      allowedRoles={["investigador"]}
    >
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />A ler inventário local de
          imagens…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          Não foi possível carregar o dataset: {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="panel p-5">
              <p className="text-sm text-muted-foreground">Conjunto</p>
              <p className="mt-1 text-2xl font-bold">{data.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.path}</p>
            </div>
            <div className="panel p-5">
              <p className="text-sm text-muted-foreground">
                Imagens encontradas
              </p>
              <p className="mt-1 text-2xl font-bold">{data.image_count}</p>
            </div>
            <div className="panel p-5">
              <p className="text-sm text-muted-foreground">Imagens anotadas</p>
              <p className="mt-1 text-2xl font-bold">
                {data.labeled_image_count}
              </p>
            </div>
            <div className="panel p-5">
              <p className="text-sm text-muted-foreground">
                Separação do dataset
              </p>
              <p className="mt-1 text-2xl font-bold">
                {data.splits.train}/{data.splits.validation}/{data.splits.test}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                treino / validação / teste
              </p>
            </div>
          </div>

          <section
            className={`panel mt-5 flex items-start gap-3 p-5 ${
              data.annotation_ready
                ? "border border-success/40"
                : "border border-warning/40"
            }`}
          >
            {data.annotation_ready ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            )}
            <div>
              <h2 className="font-semibold">
                {data.annotation_ready
                  ? "Anotações encontradas"
                  : "Imagens de inspeção, sem rótulos de treino"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{data.note}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                A classe sugerida pelo nome do ficheiro não é considerada rótulo
                validado.
              </p>
            </div>
          </section>

          <section className="panel mt-5 p-5">
            <h2 className="text-lg font-semibold">Ficheiros de imagem</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Ficheiro</th>
                    <th className="py-2 pr-3 font-medium">Dimensões</th>
                    <th className="py-2 pr-3 font-medium">Tamanho</th>
                    <th className="py-2 font-medium">Divisão</th>
                  </tr>
                </thead>
                <tbody>
                  {data.images.map((image) => (
                    <tr
                      key={image.filename}
                      className="border-b border-border/60"
                    >
                      <td className="py-3 pr-3">{image.filename}</td>
                      <td className="py-3 pr-3">
                        {image.width} × {image.height}
                      </td>
                      <td className="py-3 pr-3">
                        {formatFileSize(image.size_bytes)}
                      </td>
                      <td className="py-3">{image.split}</td>
                    </tr>
                  ))}
                  {data.images.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-muted-foreground"
                      >
                        Não há ficheiros de imagem no diretório.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </AppLayout>
  );
}
