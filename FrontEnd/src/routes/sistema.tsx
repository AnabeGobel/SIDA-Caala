import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Info,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  formatBytes,
  formatDuration,
  useOperationalStatus,
} from "@/lib/operations";

export const Route = createFileRoute("/sistema")({
  component: Sistema,
});

function Estado({ status }: { status: string }) {
  const ready = status === "operacional";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
        ready
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {ready ? (
        <CheckCircle2 className="size-4" />
      ) : (
        <TriangleAlert className="size-4" />
      )}
      {status}
    </span>
  );
}

function Linha({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

function Sistema() {
  const { data, loading, refreshing, error, refresh } = useOperationalStatus();
  const runtime = data?.runtime;

  return (
    <AppLayout
      titulo="Sistema"
      subtitulo="Verificação automática a cada minuto e atualização manual quando necessário"
      allowedRoles={["admin"]}
    >
      <div className="space-y-5">
        <section className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Server className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Diagnóstico técnico</p>
              <p className="text-xs text-muted-foreground">
                {data
                  ? `Verificado em ${new Date(data.collected_at).toLocaleString("pt-PT")}`
                  : "A consultar configurações e integrações…"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Verificar agora
          </button>
        </section>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        {loading && !data ? (
          <p role="status" className="panel p-5 text-sm text-muted-foreground">
            A verificar o sistema…
          </p>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="panel p-5">
                <div className="flex items-center gap-2">
                  <Server className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Aplicação backend</h2>
                </div>
                <div className="mt-3">
                  <Linha label="Serviço" value={data.service.name} />
                  <Linha label="Estado" value={data.service.status} />
                  <Linha
                    label="Tempo ativo"
                    value={formatDuration(data.service.uptime_seconds)}
                  />
                  <Linha
                    label="Arranque"
                    value={new Date(data.service.started_at).toLocaleString(
                      "pt-PT",
                    )}
                  />
                  <Linha
                    label="Prefixo da API"
                    value={data.configuration.api_prefix}
                  />
                </div>
              </div>

              <div className="panel p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Integrações</h2>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <Database className="size-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          Supabase / Base de dados
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.database.response_ms === null
                            ? "Tabela de análises"
                            : `Tabela de análises · ${data.database.response_ms} ms`}
                        </p>
                      </div>
                    </div>
                    <Estado status={data.database.status} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <HardDrive className="size-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Supabase Storage</p>
                        <p className="text-xs text-muted-foreground">
                          Bucket {data.configuration.image_bucket}
                          {data.storage.response_ms === null
                            ? ""
                            : ` · ${data.storage.response_ms} ms`}
                        </p>
                      </div>
                    </div>
                    <Estado status={data.storage.status} />
                  </div>
                  {!data.configuration.supabase_configured ? (
                    <p className="flex items-start gap-2 text-sm text-warning">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      As credenciais Supabase não estão configuradas no backend.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="size-5 text-primary" />
                    <h2 className="text-lg font-semibold">
                      Modelos de deteção configurados
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Disponibilidade do ficheiro e classes lidas do modelo
                    carregado no backend.
                  </p>
                </div>
                <Estado status={data.model_status} />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {data.models.map((model) => (
                  <article
                    key={model.file}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{model.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {model.file}
                          {model.size_bytes === null
                            ? ""
                            : ` · ${formatBytes(model.size_bytes)}`}
                        </p>
                      </div>
                      <Estado status={model.status} />
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Classes carregadas ({model.classes.length})
                      </p>
                      {model.classes.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {model.classes.map((className) => (
                            <span
                              key={className}
                              className="rounded-md bg-muted px-2 py-1 text-xs"
                            >
                              {className}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          As classes do modelo não estão disponíveis.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="panel p-5">
                <div className="flex items-center gap-2">
                  <Cpu className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    Ambiente de execução
                  </h2>
                </div>
                {runtime ? (
                  <div className="mt-3">
                    <Linha
                      label="Sistema operativo"
                      value={runtime.operating_system}
                    />
                    <Linha label="Python" value={runtime.python_version} />
                    <Linha
                      label="CPU do processo API"
                      value={`${runtime.process_cpu_percent.toFixed(1)}%`}
                    />
                    <Linha
                      label="Memória do processo API"
                      value={`${runtime.process_memory_mb.toFixed(1)} MB`}
                    />
                    <Linha
                      label="Memória global utilizada"
                      value={`${runtime.system_memory_percent.toFixed(1)}%`}
                    />
                    <Linha
                      label="Disco livre"
                      value={`${formatBytes(runtime.disk_free_bytes)} / ${formatBytes(runtime.disk_total_bytes)}`}
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Métricas do ambiente indisponíveis.
                  </p>
                )}
              </div>

              <div className="panel p-5">
                <div className="flex items-center gap-2">
                  <Info className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    Configuração de integração
                  </h2>
                </div>
                <div className="mt-3">
                  <Linha
                    label="Modelo principal configurado"
                    value={
                      data.configuration.primary_model_configured
                        ? "Sim"
                        : "Não"
                    }
                  />
                  <Linha
                    label="Modelo especializado configurado"
                    value={
                      data.configuration.secondary_model_configured
                        ? "Sim"
                        : "Não"
                    }
                  />
                  <Linha
                    label="Credenciais Supabase"
                    value={
                      data.configuration.supabase_configured
                        ? "Configuradas"
                        : "Em falta"
                    }
                  />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium">Origens CORS permitidas</p>
                  {data.configuration.cors_origins.length ? (
                    <ul className="mt-2 space-y-1">
                      {data.configuration.cors_origins.map((origin) => (
                        <li
                          key={origin}
                          className="break-all rounded bg-muted px-3 py-2 font-mono text-xs"
                        >
                          {origin}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Nenhuma origem foi configurada.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />A latência e a contagem
              de pedidos são medidas em memória desde o arranque do backend e
              reiniciam quando o processo é reiniciado.
            </p>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
