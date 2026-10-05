import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import type { UserRole } from "@/lib/auth-core";

export function RoleArea({
  title,
  subtitle,
  role,
  summary,
  items,
  connected = false,
}: {
  title: string;
  subtitle: string;
  role: UserRole;
  summary: string;
  items: string[];
  connected?: boolean;
}) {
  return (
    <AppLayout titulo={title} subtitulo={subtitle} allowedRoles={[role]}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Estado da área</h2>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-border p-4">
            {connected ? (
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 text-warning" />
            )}
            <p className="text-sm text-muted-foreground">
              {connected
                ? summary
                : `${summary} A ligação ao serviço desta área ainda não está configurada.`}
            </p>
          </div>
        </section>
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Capacidades</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppLayout>
  );
}
