import type { Detection } from "@/lib/detection";

export function DetectionCanvas({
  src,
  deteccoes,
  className = "",
  mode = "image",
  videoRef,
}: {
  src: string;
  deteccoes: Detection[];
  className?: string;
  mode?: "image" | "video";
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-black ${className}`}>
      {mode === "video" ? (
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
      ) : (
        <img src={src} alt="Imagem RX processada com caixas delimitadoras" className="w-full" />
      )}
      {deteccoes
        .filter((d) => d.aceite)
        .map((d, i) => (
          <div
            key={i}
            className="absolute border-2 border-destructive"
            style={{
              left: `${d.box.x * 100}%`,
              top: `${d.box.y * 100}%`,
              width: `${d.box.w * 100}%`,
              height: `${d.box.h * 100}%`,
            }}
          >
            <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
              {d.classe} {(d.confianca * 100).toFixed(1)}%
            </span>
          </div>
        ))}
    </div>
  );
}
