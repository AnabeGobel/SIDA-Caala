import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DetectionCanvas } from "@/components/DetectionCanvas";
import type { Analise } from "@/lib/detection";
import { traduzirClasse } from "@/lib/detection";
import { apiRequest } from "@/lib/auth-core";
import { useAuth } from "@/lib/use-auth";
import { getConfig, guardarAnalise, setConfig, useStore } from "@/lib/store";

export const Route = createFileRoute("/simulacao")({
  head: () => ({
    meta: [
      { title: "Nova Simulação — Análise de Imagem RX | ISPCAÁLA" },
      {
        name: "description",
        content:
          "Carregue uma imagem de raio X ou use a câmera em tempo real para simular a detecção de armas.",
      },
      { property: "og:title", content: "Nova Simulação — ISPCAÁLA" },
      {
        property: "og:description",
        content: "Upload, câmera em tempo real e análise de imagens RX.",
      },
    ],
  }),
  component: Simulacao,
});

type ModoFonte = "imagem" | "camera";
type Fonte = {
  nome: string;
  url: string;
  tipo: ModoFonte;
  ficheiro: File;
  largura: number;
  altura: number;
};

type RespostaDeteccao = {
  analysis_id: string;
  created_at: string;
  inference_ms: number;
  fps: number;
  detections: {
    class_name: string;
    confidence: number;
    bbox: { x_min: number; y_min: number; x_max: number; y_max: number };
  }[];
};

function Simulacao() {
  const [config] = useStore(useCallback(() => getConfig(), []));
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultadoVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameEmAnalise = useRef(false);
  const [modo, setModo] = useState<ModoFonte>("imagem");
  const [fonte, setFonte] = useState<Fonte | null>(null);
  const [resultado, setResultado] = useState<Analise | null>(null);
  const [limiar, setLimiar] = useState(config.limiar);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [tempoRealActivo, setTempoRealActivo] = useState(false);
  const [aAnalisar, setAAnalisar] = useState(false);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);

  const prepararFonte = useCallback(
    (nextFonte: Fonte, limparResultado = true) => {
      setFonte(nextFonte);
      if (limparResultado) {
        setResultado(null);
      }
      setErroAnalise(null);
    },
    [],
  );

  async function carregar(file: File) {
    setErroAnalise(null);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Não foi possível ler o ficheiro de imagem."));
        reader.readAsDataURL(file);
      });
      const dimensoes = await new Promise<{ largura: number; altura: number }>(
        (resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            resolve({
              largura: image.naturalWidth,
              altura: image.naturalHeight,
            });
          image.onerror = () =>
            reject(
              new Error("O ficheiro selecionado não é uma imagem válida."),
            );
          image.src = url;
        },
      );
      prepararFonte({
        nome: file.name,
        url,
        tipo: "imagem",
        ficheiro: file,
        ...dimensoes,
      });
      setModo("imagem");
    } catch (error) {
      setErroAnalise(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a imagem.",
      );
    }
  }

  const analizarFonte = useCallback(
    async (nextFonte: Fonte, manterResultado = false) => {
      if (!session) {
        setErroAnalise(
          "A sessão expirou. Inicia sessão novamente para analisar imagens.",
        );
        return;
      }
      if (!manterResultado) {
        setResultado(null);
      }
      setErroAnalise(null);
      setAAnalisar(true);
      try {
        const body = new FormData();
        body.append("file", nextFonte.ficheiro, nextFonte.nome);
        const response = await apiRequest<RespostaDeteccao>(
          session.access_token,
          `/detect?conf_threshold=${encodeURIComponent(limiar)}`,
          { method: "POST", body },
        );
        const deteccoes = response.detections.map((deteccao) => {
          const xMin = Math.max(
            0,
            Math.min(1, deteccao.bbox.x_min / nextFonte.largura),
          );
          const yMin = Math.max(
            0,
            Math.min(1, deteccao.bbox.y_min / nextFonte.altura),
          );
          const xMax = Math.max(
            xMin,
            Math.min(1, deteccao.bbox.x_max / nextFonte.largura),
          );
          const yMax = Math.max(
            yMin,
            Math.min(1, deteccao.bbox.y_max / nextFonte.altura),
          );
          return {
            classe: traduzirClasse(deteccao.class_name),
            confianca: deteccao.confidence,
            box: { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin },
            aceite: deteccao.confidence >= limiar,
          };
        });
        setResultado({
          id: response.analysis_id,
          nomeImagem: nextFonte.nome,
          imagemDataUrl: nextFonte.url,
          criadoEm: response.created_at,
          limiar,
          fps: response.fps,
          tempoMs: response.inference_ms,
          deteccoes,
          alerta: deteccoes.some((deteccao) => deteccao.aceite),
        });
      } catch (error) {
        setErroAnalise(
          error instanceof Error
            ? error.message
            : "Falha ao contactar o serviço de deteção.",
        );
      } finally {
        setAAnalisar(false);
      }
    },
    [limiar, session],
  );

  async function analisar() {
    if (modo === "camera") {
      await capturarFrameCamera();
      return;
    }
    if (fonte) await analizarFonte(fonte);
  }

  async function ligarCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraErro("Este navegador não suporta acesso à câmera.");
      return;
    }

    try {
      setCameraErro(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraAtiva(true);
      setModo("camera");
    } catch {
      setCameraErro(
        "Não foi possível ligar a câmera. Verifique as permissões do navegador.",
      );
      setCameraAtiva(false);
    }
  }

  const desligarCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraAtiva(false);
    setTempoRealActivo(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraAtiva || modo !== "camera" || !video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraErro("Não foi possível reproduzir o vídeo da câmera.");
    });
  }, [cameraAtiva, modo]);

  useEffect(() => {
    const video = resultadoVideoRef.current;
    const stream = streamRef.current;
    if (!cameraAtiva || modo !== "camera" || !fonte || !video || !stream)
      return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraErro("Não foi possível reproduzir o vídeo da câmara.");
    });
  }, [cameraAtiva, fonte !== null, modo]);

  useEffect(() => {
    return desligarCamera;
  }, [desligarCamera]);

  const capturarFrameCamera = useCallback(async () => {
    if (!videoRef.current || !cameraAtiva || frameEmAnalise.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;
    frameEmAnalise.current = true;
    try {
      const canvas = document.createElement("canvas");
      const largura = video.videoWidth || 640;
      const altura = video.videoHeight || 480;
      canvas.width = largura;
      canvas.height = altura;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Não foi possível capturar o frame da câmara.");
      context.drawImage(video, 0, 0, largura, altura);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob)
        throw new Error("Não foi possível preparar o frame para análise.");
      const nome = `camera-${Date.now()}.png`;
      const nextFonte: Fonte = {
        nome,
        url: canvas.toDataURL("image/png"),
        tipo: "camera",
        ficheiro: new File([blob], nome, { type: "image/png" }),
        largura,
        altura,
      };
      prepararFonte(nextFonte, !tempoRealActivo);
      await analizarFonte(nextFonte, tempoRealActivo);
    } catch (error) {
      setErroAnalise(
        error instanceof Error
          ? error.message
          : "Falha ao analisar o frame da câmara.",
      );
    } finally {
      frameEmAnalise.current = false;
    }
  }, [analizarFonte, cameraAtiva, prepararFonte, tempoRealActivo]);

  useEffect(() => {
    if (!tempoRealActivo || !cameraAtiva || modo !== "camera") return;
    const id = window.setInterval(() => void capturarFrameCamera(), 1200);
    return () => window.clearInterval(id);
  }, [cameraAtiva, capturarFrameCamera, modo, tempoRealActivo]);

  return (
    <AppLayout
      titulo="Nova Simulação"
      subtitulo="Upload de imagem RX ou captura em tempo real para inferência"
      allowedRoles={["operador", "admin", "investigador"]}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setModo("imagem")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                modo === "imagem"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Upload className="size-4" />
              Recarregar imagem
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("camera");
                if (!cameraAtiva) void ligarCamera();
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                modo === "camera"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Camera className="size-4" />
              {cameraAtiva ? "Câmera ligada" : "Ligar câmera"}
            </button>
          </div>

          {modo === "imagem" ? (
            <>
              <h2 className="mt-5 text-lg font-semibold">
                1. Carregar imagem de raio X
              </h2>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) carregar(f);
                }}
                onClick={() => inputRef.current?.click()}
                className="mt-4 cursor-pointer rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary"
              >
                <Upload className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  Arraste a imagem ou clique para escolher
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG — dataset de imagens RX
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) carregar(f);
                  }}
                />
              </div>

              {fonte ? (
                <p className="mt-3 truncate text-xs text-muted-foreground">
                  Ficheiro: {fonte.nome} (
                  {fonte.tipo === "imagem" ? "imagem carregada" : "câmara"})
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="mt-5 text-lg font-semibold">
                1. Câmara em tempo real
              </h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-black">
                {cameraAtiva ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-72 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    A câmara ainda não está ligada. Ative-a para começar a
                    análise.
                  </div>
                )}
              </div>

              {cameraErro ? (
                <p className="mt-3 text-sm text-destructive">{cameraErro}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                {!cameraAtiva ? (
                  <button
                    type="button"
                    onClick={() => void ligarCamera()}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Camera className="size-4" />
                    Ligar câmera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTempoRealActivo((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    {tempoRealActivo ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {tempoRealActivo
                      ? "Pausar análise"
                      : "Iniciar análise em tempo real"}
                  </button>
                )}

                {cameraAtiva ? (
                  <button
                    type="button"
                    onClick={desligarCamera}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    <RefreshCw className="size-4" />
                    Desligar câmera
                  </button>
                ) : null}
              </div>
            </>
          )}

          <div className="mt-6">
            <label className="flex items-center justify-between text-sm font-medium">
              Limiar de confiança
              <span className="text-primary">{limiar.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={0.95}
              step={0.01}
              value={limiar}
              onChange={(e) => setLimiar(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--color-primary)]"
            />
            <button
              onClick={() => setConfig({ ...config, limiar })}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Definir como limiar padrão do sistema
            </button>
          </div>

          <button
            disabled={aAnalisar || (modo === "imagem" ? !fonte : !cameraAtiva)}
            onClick={analisar}
            className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {aAnalisar
              ? "A analisar…"
              : modo === "camera"
                ? "Analisar frame atual"
                : "Executar deteção"}
          </button>

          {erroAnalise ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {erroAnalise}
            </p>
          ) : null}
          {aAnalisar ? (
            <p
              role="status"
              className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />A enviar imagem para o
              detector…
            </p>
          ) : resultado ? (
            <p role="status" className="mt-4 text-sm text-success">
              Análise concluída pelo modelo YOLO.
            </p>
          ) : null}
        </section>

        <section className="space-y-5">
          {resultado?.alerta ? (
            <div className="alert-gradient flex items-center gap-4 rounded-xl border border-destructive/60 p-5">
              <AlertTriangle className="size-10 text-destructive" />
              <div>
                <p className="text-lg font-bold">
                  ⚠ ALERTA — Deteção relevante
                </p>
                <p className="text-sm text-muted-foreground">
                  Classe: {resultado.deteccoes.find((d) => d.aceite)?.classe} ·
                  Confiança:{" "}
                  {(
                    (resultado.deteccoes.find((d) => d.aceite)?.confianca ??
                      0) * 100
                  ).toFixed(1)}
                  %
                </p>
              </div>
            </div>
          ) : null}

          <div className="panel p-5">
            <h2 className="text-lg font-semibold">
              2. Resultado da inferência
            </h2>
            {fonte ? (
              <DetectionCanvas
                src={fonte.url}
                deteccoes={resultado?.deteccoes ?? []}
                className="mt-4"
                mode={
                  fonte.tipo === "camera" && cameraAtiva ? "video" : "image"
                }
                videoRef={resultadoVideoRef}
              />
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nenhuma imagem ou feed da câmara disponível.
              </p>
            )}

            {resultado ? (
              <>
                <table className="mt-5 w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 font-medium">Classe</th>
                      <th className="py-2 font-medium">Confiança</th>
                      <th className="py-2 font-medium">
                        Coordenadas (x, y, w, h)
                      </th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.deteccoes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-muted-foreground">
                          Nenhum objeto detectado nesta imagem.
                        </td>
                      </tr>
                    ) : (
                      resultado.deteccoes.map((d, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td className="py-2">{d.classe}</td>
                          <td className="py-2">
                            {(d.confianca * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {d.box.x.toFixed(2)}, {d.box.y.toFixed(2)},{" "}
                            {d.box.w.toFixed(2)}, {d.box.h.toFixed(2)}
                          </td>
                          <td
                            className={`py-2 ${d.aceite ? "text-success" : "text-muted-foreground"}`}
                          >
                            {d.aceite ? "Aceite" : "Descartada"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Tempo de inferência: {resultado.tempoMs} ms ·{" "}
                    {resultado.fps} FPS · limiar {resultado.limiar.toFixed(2)}
                  </span>
                  <span className="text-sm font-medium text-success">
                    Registado automaticamente no histórico
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
