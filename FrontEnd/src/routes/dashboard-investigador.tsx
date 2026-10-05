import { createFileRoute } from "@tanstack/react-router";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";

export const Route = createFileRoute("/dashboard-investigador")({
  component: () => (
    <AnalysisDashboard
      title="Dashboard de investigação"
      subtitle="Análises reais disponíveis para consulta"
      role="investigador"
    />
  ),
});
