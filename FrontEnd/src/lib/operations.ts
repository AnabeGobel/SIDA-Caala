import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/auth-core";
import { useAuth } from "@/lib/use-auth";

const OPERATIONS_REFRESH_INTERVAL_MS = 60_000;

export type OperationalStatus = {
  collected_at: string;
  service: {
    name: string;
    status: string;
    started_at: string;
    uptime_seconds: number;
  };
  runtime: {
    python_version: string;
    operating_system: string;
    process_uptime_seconds: number;
    process_cpu_percent: number;
    process_memory_mb: number;
    system_memory_percent: number;
    disk_total_bytes: number;
    disk_used_bytes: number;
    disk_free_bytes: number;
    disk_used_percent: number;
  } | null;
  models: {
    name: string;
    file: string;
    available: boolean;
    size_bytes: number | null;
    classes: string[];
    status: string;
  }[];
  model_status: string;
  database: {
    status: string;
    response_ms: number | null;
    error?: string;
  };
  storage: {
    status: string;
    response_ms: number | null;
    error?: string;
  };
  analyses: {
    total: number | null;
    last_24_hours: number | null;
    average_inference_ms: number | null;
    sampled_records: number;
  };
  requests: {
    uptime_seconds: number;
    total_requests: number;
    client_errors: number;
    server_errors: number;
    last_request_at: string | null;
    status_counts: Record<string, number>;
    recent_sample_count: number;
    recent_average_latency_ms: number | null;
    recent_p95_latency_ms: number | null;
    recent_max_latency_ms: number | null;
    top_routes: { route: string; requests: number }[];
  };
  configuration: {
    api_prefix: string;
    image_bucket: string;
    cors_origins: string[];
    primary_model_configured: boolean;
    secondary_model_configured: boolean;
    supabase_configured: boolean;
  };
};

export function useOperationalStatus() {
  const { session } = useAuth();
  const [data, setData] = useState<OperationalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!session?.access_token) {
      setData(null);
      setLoading(false);
      setError("É necessário iniciar sessão como administrador.");
      return;
    }
    let active = true;
    let inFlight = false;
    let timer: number | undefined;

    const scheduleRefresh = () => {
      if (!active || document.visibilityState !== "visible") return;
      timer = window.setTimeout(loadStatus, OPERATIONS_REFRESH_INTERVAL_MS);
    };

    const loadStatus = async () => {
      if (!active || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      setRefreshing(true);
      setError(null);
      try {
        const result = await apiRequest<OperationalStatus>(
          session.access_token,
          "/admin/operations",
        );
        if (active) setData(result);
      } catch (cause: unknown) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível obter o estado operacional.",
          );
        }
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          setRefreshing(false);
          scheduleRefresh();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (timer !== undefined) window.clearTimeout(timer);
        void loadStatus();
      } else if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    refreshRef.current = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      void loadStatus();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void loadStatus();

    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      refreshRef.current = () => {};
    };
  }, [session?.access_token]);

  return { data, loading, refreshing, error, refresh };
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = units[0];
  for (let index = 0; size >= 1024 && index < units.length - 1; index += 1) {
    size /= 1024;
    unit = units[index + 1];
  }
  return `${size.toFixed(1)} ${unit}`;
}
