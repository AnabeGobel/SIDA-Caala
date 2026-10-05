import { createFileRoute } from "@tanstack/react-router";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";

export const Route = createFileRoute("/dashboard-admin")({
  component: () => (
    <AnalysisDashboard
      title="Dashboard administrativo"
      subtitle="Visão geral das análises guardadas no sistema"
      role="admin"
    />
  ),
});
