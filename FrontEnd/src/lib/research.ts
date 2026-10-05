import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/auth-core";

export type ResearchModel = {
  name: string;
  filename: string;
  size_bytes: number;
  modified_at: number;
  task: string;
  loaded: boolean;
  classes: { id: number; name: string }[];
};

export type ResearchModelsResponse = {
  active_model: string;
  confirmation_model: string;
  models: ResearchModel[];
};

export type ResearchDatasetResponse = {
  name: string;
  path: string;
  images: {
    filename: string;
    size_bytes: number;
    width: number;
    height: number;
    split: string;
  }[];
  image_count: number;
  labeled_image_count: number;
  annotation_ready: boolean;
  splits: { train: number; validation: number; test: number };
  note: string;
};

export type ResearchEvaluationResponse = {
  image_count: number;
  evaluated_count: number;
  skipped_count: number;
  truncated: boolean;
  confidence_threshold: number;
  mean_inference_ms: number;
  total_detections: number;
  class_counts: Record<string, number>;
  results: {
    filename: string;
    width: number;
    height: number;
    inference_ms: number;
    detections: {
      class_id: number;
      class_name: string;
      confidence: number;
    }[];
  }[];
  errors: { filename: string; message: string }[];
  scientific_metrics_available: boolean;
  metrics_note: string;
};

export function useResearchData<T>(path: string, accessToken: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    setData(null);
    setLoading(true);
    setError(null);
    apiRequest<T>(accessToken, path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar os dados de investigação.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, path]);

  return { data, loading, error };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
