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
import { getConfig, setConfig, useStore } from "@/lib/store";

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aLigarCamera = useRef(false);
  const montadoRef = useRef(true);
  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [dispositivoId, setDispositivoId] = useState("");
  const frameEmAnalise = useRef(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [modo, setModo] = useState<ModoFonte>("imagem");
  const [fonte, setFonte] = useState<Fonte | null>(null);
  const [resultado, setResultado] = useState<Analise | null>(null);
  const [limiar, setLimiar] = useState(config.limiar);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraPronta, setCameraPronta] = useState(false);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [tempoRealActivo, setTempoRealActivo] = useState(false);
  const [aAnalisar, setAAnalisar] = useState(false);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);

  function marcarPronta(event: React.SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setCameraPronta(true);
      setCameraErro(null);
    }
  }

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
        const tempoMs = Math.max(0, response.inference_ms);
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
          tempoMs,
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

  async function ligarCamera(deviceId?: string) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraErro(
        "A câmera não está disponível. Usa HTTPS ou localhost e confirma as permissões do navegador.",
      );
      return;
    }
    // Evita abrir duas streams em simultâneo (cliques duplos) — a primeira
    // ficaria presa e a câmera mostraria preto/cinza.
    if (aLigarCamera.current) return;
    aLigarCamera.current = true;

    try {
      setCameraErro(null);
      setCameraPronta(false);
      setModo("camera");

      // Liberta qualquer stream anterior antes de pedir outra.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const idEscolhido = deviceId ?? dispositivoId;
      const tentativas: MediaStreamConstraints[] = [
        {
          video: idEscolhido
            ? {
                deviceId: { exact: idEscolhido },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let ultimoErro: unknown = null;
      for (const constraints of tentativas) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          ultimoErro = err;
          const nome = err instanceof Error ? err.name : "";
          // Só vale a pena tentar a configuração simples se foi um problema de constraints.
          if (nome !== "OverconstrainedError" && nome !== "NotFoundError")
            break;
        }
      }
      if (!stream) throw ultimoErro;

      // Se o componente foi desmontado durante o pedido de permissão, não deixar a câmera ligada.
      if (!montadoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setCameraStream(stream);
      setCameraAtiva(true);

      // Depois da permissão, os nomes das câmeras já ficam disponíveis.
      try {
        const lista = await navigator.mediaDevices.enumerateDevices();
        setDispositivos(lista.filter((d) => d.kind === "videoinput"));
        const atual = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (atual) setDispositivoId(atual);
      } catch {
        /* a lista de câmeras é opcional */
      }
    } catch (error) {
      const cameraError = error instanceof Error ? error.name : "";
      const message =
        cameraError === "NotAllowedError" || cameraError === "SecurityError"
          ? "Acesso à câmera bloqueado. Permite o acesso nas definições do navegador e usa HTTPS ou localhost."
          : cameraError === "NotFoundError"
            ? "Não foi encontrada nenhuma câmera ligada a este dispositivo."
            : cameraError === "NotReadableError"
              ? "A câmera está a ser usada por outra aplicação ou separador. Fecha-a e tenta novamente."
              : cameraError === "OverconstrainedError"
                ? "A câmera não suporta a configuração pedida. Verifica o dispositivo e tenta novamente."
                : `Não foi possível iniciar a câmera${error instanceof Error ? `: ${error.message}` : "."}`;
      setCameraErro(message);
      setCameraAtiva(false);
      setCameraPronta(false);
      setCameraStream(null);
      streamRef.current = null;
    } finally {
      aLigarCamera.current = false;
    }
  }

  const desligarCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraAtiva(false);
    setCameraPronta(false);
    setTempoRealActivo(false);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraAtiva || modo !== "camera" || !video || !cameraStream) return;

    const temImagem = () =>
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0;

    const [track] = cameraStream.getVideoTracks();
    const handleEnded = () => {
      setCameraErro("A ligação da câmera foi interrompida.");
      setCameraAtiva(false);
      setCameraPronta(false);
      setTempoRealActivo(false);
    };
    const handleMute = () => {
      setCameraPronta(false);
      setCameraErro(
        "A câmera está ligada, mas não está a enviar imagem. Verifica se a lente está tapada ou se outro programa está a usar o dispositivo.",
      );
    };
    const handleUnmute = () => {
      setCameraErro(null);
      if (temImagem()) setCameraPronta(true);
    };
    track?.addEventListener("ended", handleEnded);
    track?.addEventListener("mute", handleMute);
    track?.addEventListener("unmute", handleUnmute);

    // Só reatribui se for uma stream diferente (evita AbortError no play()).
    if (video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
    }
    video.muted = true;
    void video
      .play()
      .then(() => {
        if (temImagem()) {
          setCameraPronta(true);
          setCameraErro(null);
        }
      })
      .catch((err: unknown) => {
        // AbortError acontece quando o srcObject muda durante o play(); não é um erro real.
        if (err instanceof Error && err.name === "AbortError") return;
        setCameraPronta(false);
        setCameraErro(
          "O navegador bloqueou a reprodução da câmera. Confirma as permissões e tenta ligar novamente.",
        );
      });

    const frameTimeout = window.setTimeout(() => {
      if (!temImagem()) {
        setCameraPronta(false);
        setCameraErro(
          "A câmera foi ligada, mas não enviou imagem. Se o portátil tem mais de uma câmera (ex.: infravermelhos ou virtual), escolhe outra na lista abaixo.",
        );
      }
    }, 5000);
    return () => {
      window.clearTimeout(frameTimeout);
      track?.removeEventListener("ended", handleEnded);
      track?.removeEventListener("mute", handleMute);
      track?.removeEventListener("unmute", handleUnmute);
    };
  }, [cameraAtiva, cameraStream, modo]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      desligarCamera();
    };
  }, [desligarCamera]);

  const capturarFrameCamera = useCallback(async () => {
    if (!videoRef.current || !cameraAtiva || !cameraStream) {
      setErroAnalise("Liga a câmera antes de solicitar uma análise.");
      return;
    }
    if (frameEmAnalise.current) return;
    const video = videoRef.current;
    if (
      !cameraPronta ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setErroAnalise(
        "A câmera ainda está a iniciar. Aguarda a imagem aparecer e tenta novamente.",
      );
      return;
    }
    frameEmAnalise.current = true;
    try {
      const canvas = document.createElement("canvas");
      const largura = video.videoWidth;
      const altura = video.videoHeight;
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
  }, [
    analizarFonte,
    cameraAtiva,
    cameraPronta,
    cameraStream,
    prepararFonte,
    tempoRealActivo,
  ]);

  useEffect(() => {
    if (!tempoRealActivo || !cameraAtiva || !cameraPronta || modo !== "camera")
      return;
    const id = window.setInterval(() => void capturarFrameCamera(), 1200);
    return () => window.clearInterval(id);
  }, [cameraAtiva, cameraPronta, capturarFrameCamera, modo, tempoRealActivo]);

  return (
    <AppLayout
      titulo="Nova Simulação"
      subtitulo="Upload de imagem RX ou captura em tempo real para inferência"
      allowedRoles={["operador", "admin", "investigador"]}
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="panel min-w-0 p-5">
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
                className="mt-4 cursor-pointer rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-primary hover:bg-accent/40 sm:p-8"
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
              <div className="relative mt-4 h-72 overflow-hidden rounded-xl border border-border bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  onLoadedData={marcarPronta}
                  onCanPlay={marcarPronta}
                  onPlaying={marcarPronta}
                  onResize={marcarPronta}
                  onWaiting={() => {
                    setCameraPronta(false);
                  }}
                  onError={() => {
                    setCameraPronta(false);
                    setCameraErro(
                      "Não foi possível apresentar a imagem da câmera neste navegador.",
                    );
                  }}
                  className={`h-full w-full object-contain ${
                    cameraAtiva ? "block" : "hidden"
                  }`}
                />
                {!cameraAtiva && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted px-6 text-center text-sm text-muted-foreground">
                    <>A câmara está desligada. Liga-a para ver a imagem.</>
                  </div>
                )}
                {cameraAtiva && !cameraPronta && (
                  <span
                    role="status"
                    className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/70 px-3 py-2 text-xs text-white"
                  >
                    <Loader2 className="size-4 animate-spin" />A aguardar imagem
                    da câmera…
                  </span>
                )}
                {cameraAtiva && cameraPronta && (
                  <span className="absolute left-3 top-3 rounded-md bg-success px-2 py-1 text-xs font-bold text-white">
                    AO VIVO
                  </span>
                )}
                {aAnalisar && modo === "camera" && (
                  <div
                    role="status"
                    className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/75 px-4 py-3 text-sm font-medium text-white"
                  >
                    <Loader2 className="size-4 animate-spin" />A analisar o
                    frame capturado…
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
                  <>
                    <button
                      type="button"
                      disabled={!cameraPronta}
                      onClick={() => setTempoRealActivo((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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
                    {cameraErro ? (
                      <button
                        type="button"
                        onClick={() => {
                          desligarCamera();
                          void ligarCamera();
                        }}
                        className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
                      >
                        Tentar ligar novamente
                      </button>
                    ) : null}
                  </>
                )}

                {cameraAtiva && dispositivos.length > 1 ? (
                  <select
                    value={dispositivoId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setDispositivoId(id);
                      desligarCamera();
                      void ligarCamera(id);
                    }}
                    aria-label="Escolher câmera"
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    {dispositivos.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Câmera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                ) : null}

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
            disabled={
              aAnalisar ||
              (modo === "imagem" ? !fonte : !cameraAtiva || !cameraPronta)
            }
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
              Análise concluída e guardada no banco de dados.
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

          <div className="panel min-w-0 p-5">
            <h2 className="text-lg font-semibold">
              2. Resultado da inferência
            </h2>
            {fonte ? (
              <>
                <p role="status" className="mt-2 text-sm text-muted-foreground">
                  {aAnalisar
                    ? "A analisar esta captura…"
                    : resultado?.imagemDataUrl === fonte.url
                      ? `Captura analisada: ${resultado.deteccoes.length} deteção(ões).`
                      : "Pré-visualização da imagem selecionada."}
                </p>
                <DetectionCanvas
                  src={fonte.url}
                  deteccoes={
                    resultado?.imagemDataUrl === fonte.url
                      ? resultado.deteccoes
                      : []
                  }
                  className="mt-4"
                />
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                {cameraAtiva
                  ? "Câmara ao vivo no painel à esquerda. Seleciona «Analisar frame atual» para ver aqui a captura analisada."
                  : "Nenhuma imagem disponível. Carrega uma imagem ou liga a câmara."}
              </p>
            )}

            {resultado ? (
              <>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm">
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
                          <td
                            colSpan={4}
                            className="py-4 text-muted-foreground"
                          >
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
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Tempo de inferência: {resultado.tempoMs} ms ·{" "}
                    {resultado.fps} FPS · limiar {resultado.limiar.toFixed(2)}
                  </span>
                  <span className="text-success">
                    Registo persistido automaticamente
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
