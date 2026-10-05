import type { ReactNode } from "react";

export function StatCard({
  icone,
  cor,
  titulo,
  valor,
  nota,
}: {
  icone: ReactNode;
  cor: "info" | "destructive" | "warning" | "success";
  titulo: string;
  valor: string;
  nota: string;
}) {
  const fundo = {
    info: "bg-primary",
    destructive: "bg-destructive",
    warning: "bg-warning",
    success: "bg-success",
  }[cor];

  return (
    <div className="panel flex min-w-0 items-center gap-3 p-4">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${fundo}`}
      >
        {icone}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
          {titulo}
        </p>
        <p className="truncate text-2xl font-bold leading-tight">{valor}</p>
        <p className="truncate text-xs text-muted-foreground">{nota}</p>
      </div>
    </div>
  );
}
