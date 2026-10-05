import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock3,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  Cpu,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  formatBytes,
  formatDuration,
  useOperationalStatus,
} from "@/lib/operations";

export const Route = createFileRoute("/monitorizacao")({
  component: Monitorizacao,
});

function StatusBadge({ status }: { status: string }) {
  const operational = status === "operacional";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        operational
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {operational ? (
        <ShieldCheck className="size-3.5" />
      ) : (
        <TriangleAlert className="size-3.5" />
      )}
      {status}
    </span>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <Icon className="size-5 text-primary" />
      </div>
    </article>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{safeValue.toFixed(1)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full ${
            safeValue >= 90 ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function Monitorizacao() {
  const { data, loading, refreshing, error, refresh } = useOperationalStatus();
  const runtime = data?.runtime;
  const requests = data?.requests;
  const analyses = data?.analyses;

  return (
    <AppLayout
      titulo="Monitorização"
      subtitulo="Atualização automática a cada minuto; também pode verificar manualmente"
      allowedRoles={["admin"]}
    >
      <div className="space-y-5">
        <section className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Activity className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">
                {data?.service.name ?? "Backend"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data
                  ? `Última recolha: ${new Date(data.collected_at).toLocaleString("pt-PT")}`
                  : "A recolher estado dos serviços…"}
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
            Atualizar
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
            A consultar API, modelos, base de dados e armazenamento…
          </p>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Disponibilidade da API"
                value={data.service.status}
                detail={`Em execução há ${formatDuration(data.service.uptime_seconds)}`}
                icon={Server}
              />
              <article className="panel p-5">
                <p className="text-sm text-muted-foreground">Base de dados</p>
                <div className="mt-2">
                  <StatusBadge status={data.database.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.database.error ??
                    `Resposta: ${data.database.response_ms ?? "—"}${data.database.response_ms === null ? "" : " ms"}`}
                </p>
              </article>
              <article className="panel p-5">
                <p className="text-sm text-muted-foreground">Armazenamento</p>
                <div className="mt-2">
                  <StatusBadge status={data.storage.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.storage.error ??
                    `Bucket privado: ${data.configuration.image_bucket}`}
                </p>
              </article>
              <article className="panel p-5">
                <p className="text-sm text-muted-foreground">Modelos YOLO</p>
                <div className="mt-2">
                  <StatusBadge status={data.model_status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.models.filter((model) => model.available).length} de{" "}
                  {data.models.length} pesos disponíveis
                </p>
              </article>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="panel space-y-5 p-5">
                <div className="flex items-center gap-2">
                  <Cpu className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    Recursos do servidor
                  </h2>
                </div>
                {runtime ? (
                  <>
                    <ProgressRow
                      label="Memória do sistema utilizada"
                      value={runtime.system_memory_percent}
                    />
                    <ProgressRow
                      label="Disco utilizado"
                      value={runtime.disk_used_percent}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricCard
                        title="CPU do processo API"
                        value={`${runtime.process_cpu_percent.toFixed(1)}%`}
                        detail="Amostra recolhida nesta consulta"
                        icon={Cpu}
                      />
                      <MetricCard
                        title="Memória do processo API"
                        value={`${runtime.process_memory_mb.toFixed(1)} MB`}
                        detail="Memória residente (RSS)"
                        icon={HardDrive}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Espaço em disco: {formatBytes(runtime.disk_free_bytes)}{" "}
                      livres de {formatBytes(runtime.disk_total_bytes)}.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Métricas de recursos indisponíveis neste servidor.
                  </p>
                )}
              </div>

              <div className="panel p-5">
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Pedidos à API</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Contagem desde o arranque do backend; latências calculadas
                  sobre a janela mais recente de pedidos observados.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MetricCard
                    title="Pedidos"
                    value={String(requests?.total_requests ?? 0)}
                    detail={`Amostra de latência: ${requests?.recent_sample_count ?? 0}`}
                    icon={ArrowDown}
                  />
                  <MetricCard
                    title="Erros HTTP"
                    value={String(
                      (requests?.client_errors ?? 0) +
                        (requests?.server_errors ?? 0),
                    )}
                    detail={`${requests?.client_errors ?? 0} cliente · ${requests?.server_errors ?? 0} servidor`}
                    icon={AlertTriangle}
                  />
                  <MetricCard
                    title="Latência média recente"
                    value={
                      requests?.recent_average_latency_ms === null ||
                      requests?.recent_average_latency_ms === undefined
                        ? "—"
                        : `${requests.recent_average_latency_ms} ms`
                    }
                    detail="Últimos pedidos medidos"
                    icon={Clock3}
                  />
                  <MetricCard
                    title="Latência P95 recente"
                    value={
                      requests?.recent_p95_latency_ms === null ||
                      requests?.recent_p95_latency_ms === undefined
                        ? "—"
                        : `${requests.recent_p95_latency_ms} ms`
                    }
                    detail={`Máximo recente: ${requests?.recent_max_latency_ms ?? "—"} ms`}
                    icon={ArrowUp}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="panel p-5">
                <div className="flex items-center gap-2">
                  <Database className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    Análises persistidas
                  </h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    title="Total no banco"
                    value={
                      analyses?.total === null || analyses?.total === undefined
                        ? "—"
                        : String(analyses.total)
                    }
                    detail="Registos guardados"
                    icon={Database}
                  />
                  <MetricCard
                    title="Últimas 24 horas"
                    value={
                      analyses?.last_24_hours === null ||
                      analyses?.last_24_hours === undefined
                        ? "—"
                        : String(analyses.last_24_hours)
                    }
                    detail="Contagem consultada no banco"
                    icon={Activity}
                  />
                  <MetricCard
                    title="Inferência média"
                    value={
                      analyses?.average_inference_ms === null ||
                      analyses?.average_inference_ms === undefined
                        ? "—"
                        : `${analyses.average_inference_ms} ms`
                    }
                    detail={`Amostra recente: ${analyses?.sampled_records ?? 0} registos`}
                    icon={Clock3}
                  />
                </div>
              </div>

              <div className="panel p-5">
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    Rotas mais utilizadas
                  </h2>
                </div>
                {requests?.top_routes.length ? (
                  <ul className="mt-4 space-y-3">
                    {requests.top_routes.map((route) => (
                      <li
                        key={route.route}
                        className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm"
                      >
                        <code className="truncate">{route.route}</code>
                        <span className="font-semibold">{route.requests}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Ainda não há pedidos registados desde o arranque.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
