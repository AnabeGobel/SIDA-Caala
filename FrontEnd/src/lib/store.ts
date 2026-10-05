import { useCallback, useEffect, useState } from "react";
import type { Analise, Detection } from "./detection";
import { traduzirClasse } from "./detection";
import { apiRequest } from "./auth-core";

const K_CONFIG = "sida.config";
const K_ALERTAS = "sida.alertas_confirmados";

export type Config = { limiar: number; alertaSonoro: boolean; modelo: string };
export const CONFIG_PADRAO: Config = {
  limiar: 0.65,
  alertaSonoro: true,
  modelo: "YOLOv8n (640×640)",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("sida:update"));
}

/* ---------------- análises / logs ---------------- */

type StoredDetection = {
  class_name: string;
  confidence: number;
  bbox: { x_min: number; y_min: number; x_max: number; y_max: number };
};

type StoredAnalysis = {
  id: string;
  filename: string;
  image_width: number;
  image_height: number;
  confidence_threshold: number;
  inference_ms: number;
  fps: number;
  has_alert: boolean;
  detections: StoredDetection[];
  created_at: string;
};

function toAnalysis(row: StoredAnalysis): Analise {
  const deteccoes: Detection[] = row.detections.map((detection) => {
    const x = detection.bbox.x_min / row.image_width;
    const y = detection.bbox.y_min / row.image_height;
    const xMax = detection.bbox.x_max / row.image_width;
    const yMax = detection.bbox.y_max / row.image_height;
    return {
      classe: traduzirClasse(detection.class_name),
      confianca: detection.confidence,
      box: {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        w: Math.max(0, Math.min(1, xMax) - Math.max(0, Math.min(1, x))),
        h: Math.max(0, Math.min(1, yMax) - Math.max(0, Math.min(1, y))),
      },
      aceite: detection.confidence >= row.confidence_threshold,
    };
  });
  return {
    id: row.id,
    nomeImagem: row.filename,
    imagemDataUrl: "",
    criadoEm: row.created_at,
    limiar: row.confidence_threshold,
    fps: row.fps,
    tempoMs: row.inference_ms,
    deteccoes,
    alerta: row.has_alert,
  };
}

export function useAnalises(accessToken: string | null) {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const refresh = useCallback(() => setRequestKey((key) => key + 1), []);

  useEffect(() => {
    if (!accessToken) {
      setAnalises([]);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    setAnalises([]);
    setLoading(true);
    setError(null);
    apiRequest<StoredAnalysis[]>(accessToken, "/analyses")
      .then((rows) => {
        if (active) setAnalises(rows.map(toAnalysis));
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar o histórico.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, requestKey]);

  return { analises, loading, error, refresh };
}

export function alertasConfirmados(): string[] {
  return read<string[]>(K_ALERTAS, []);
}

export function confirmarAlerta(id: string) {
  write(K_ALERTAS, Array.from(new Set([...alertasConfirmados(), id])));
}

/* ---------------- configuração ---------------- */

export function getConfig(): Config {
  return { ...CONFIG_PADRAO, ...read<Partial<Config>>(K_CONFIG, {}) };
}

export function setConfig(config: Config) {
  write(K_CONFIG, config);
}

/* ---------------- hook reactivo ---------------- */

export function useStore<T>(selector: () => T): [T, () => void] {
  const [valor, setValor] = useState<T>(selector);
  const refresh = useCallback(() => setValor(selector()), [selector]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("sida:update", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("sida:update", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  return [valor, refresh];
}
