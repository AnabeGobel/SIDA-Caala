import { createFileRoute } from "@tanstack/react-router";
import { Download, FileDown, Loader2, Search, Trash2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DetectionCanvas } from "@/components/DetectionCanvas";
import type { Analise, Detection } from "@/lib/detection";
import { CLASSES } from "@/lib/detection";
import { apiBlobRequest, apiRequest } from "@/lib/auth-core";
import { useAuth } from "@/lib/use-auth";
import { useAnalises } from "@/lib/store";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de Detecções — ISPCAÁLA" },
      {
        name: "description",
        content: "Registo completo das detecções: data, classe identificada, confiança e limiar aplicado.",
      },
      { property: "og:title", content: "Histórico de Detecções — ISPCAÁLA" },
      { property: "og:description", content: "Logs de todas as análises de imagens RX." },
    ],
  }),
  component: Historico,
});

function Historico() {
  const { session, profile } = useAuth();
  const { analises, loading, error } = useAnalises(
    session?.access_token ?? null,
  );
  const [busca, setBusca] = useState("");
  const [classe, setClasse] = useState("todas");
  const [detalhe, setDetalhe] = useState<Analise | null>(null);
  const [imagemLoading, setImagemLoading] = useState(false);
  const [imagemError, setImagemError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminandoTudo, setEliminandoTudo] = useState(false);
  const [erroEliminacao, setErroEliminacao] = useState<string | null>(null);
  const [idsEliminados, setIdsEliminados] = useState<Set<string>>(
    () => new Set(),
  );
  const [confirmacaoEliminacao, setConfirmacaoEliminacao] = useState<
    { tipo: "individual"; analise: Analise } | { tipo: "historico" } | null
  >(null);
  const imagemUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (imagemUrlRef.current) URL.revokeObjectURL(imagemUrlRef.current);
    },
    [],
  );

  type Linha = { analise: Analise; det: Detection | null };

  const analisesVisiveis = analises.filter(
    (analise) => !idsEliminados.has(analise.id),
  );
  const linhas: Linha[] = analisesVisiveis
    .flatMap<Linha>((a) =>
      a.deteccoes.length
        ? a.deteccoes.map((d) => ({ analise: a, det: d }))
        : [{ analise: a, det: null }],
    )
    .filter(({ analise, det }) => {
      if (classe !== "todas" && det?.classe !== classe) return false;
      if (busca && !analise.nomeImagem.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });

  function exportarCsv() {
    const escapar = (valor: string) => `"${valor.replaceAll('"', '""')}"`;
    const cabecalho = "Data,Imagem,Classe,Confianca,Limiar,Estado\n";
    const corpo = linhas
      .map(
        ({ analise, det }) =>
          [
            escapar(new Date(analise.criadoEm).toLocaleString("pt-PT")),
            escapar(analise.nomeImagem),
            escapar(det?.classe ?? "Nenhum objeto"),
            det ? `${(det.confianca * 100).toFixed(1)}%` : "-",
            analise.limiar.toFixed(2),
            det ? (det.aceite ? "Aceite" : "Descartada") : "-",
          ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", cabecalho, corpo], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico_deteccoes.csv";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportarPdf() {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const desenharCabecalho = () => {
      pdf.setFillColor(24, 74, 120);
      pdf.roundedRect(14, 10, 18, 18, 3, 3, "F");
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(1.4);
      pdf.line(18, 19, 21, 22);
      pdf.line(21, 22, 28, 15);
      pdf.setTextColor(24, 74, 120);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("SISTEMA INTELIGENTE", 38, 15);
      pdf.text("DE DETECÇÃO DE ARMAS", 38, 21);
      pdf.setFontSize(9);
      pdf.text("ISPCAÁLA", 38, 27);
      pdf.setDrawColor(24, 74, 120);
      pdf.setLineWidth(0.5);
      pdf.line(14, 32, 196, 32);
    };

    const linhasPdf = linhas.map(({ analise, det }) => [
      new Date(analise.criadoEm).toLocaleString("pt-PT"),
      analise.nomeImagem,
      det?.classe ?? "Nenhum objeto",
      det ? `${(det.confianca * 100).toFixed(1)}%` : "—",
      analise.limiar.toFixed(2),
      det ? (det.aceite ? "Aceite" : "Descartada") : "Sem deteção",
    ]);

    desenharCabecalho();
    pdf.setTextColor(35, 35, 35);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("RELATÓRIO DE ANÁLISES DE DETEÇÃO", 14, 41);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      `Finalidade: documentar as análises realizadas, os objetos identificados, a confiança e o limiar aplicado.`,
      14,
      47,
      { maxWidth: 180 },
    );
    pdf.text(
      `Emitido em ${new Date().toLocaleString("pt-PT")} · ${new Set(
        linhas.map(({ analise }) => analise.id),
      ).size} análises · ${linhas.length} registos`,
      14,
      55,
    );

    autoTable(pdf, {
      startY: 60,
      head: [["Data / Hora", "Imagem", "Classe", "Confiança", "Limiar", "Estado"]],
      body: linhasPdf,
      margin: { top: 38, right: 14, bottom: 18, left: 14 },
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.2 },
      headStyles: { fillColor: [24, 74, 120] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 48 },
        2: { cellWidth: 35 },
        3: { cellWidth: 20 },
        4: { cellWidth: 16 },
        5: { cellWidth: 27 },
      },
      didDrawPage: () => {
        desenharCabecalho();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(
          `Documento gerado pelo sistema ISPCAÁLA · Página ${pdf.getNumberOfPages()}`,
          14,
          289,
        );
      },
    });
    pdf.save("relatorio_deteccoes_ispcaala.pdf");
  }

  async function abrirDetalhe(analise: Analise) {
    if (imagemUrlRef.current) URL.revokeObjectURL(imagemUrlRef.current);
    imagemUrlRef.current = null;
    setDetalhe(analise);
    setImagemError(null);
    if (!session?.access_token) return;

    setImagemLoading(true);
    try {
      const blob = await apiBlobRequest(
        session.access_token,
        `/analyses/${encodeURIComponent(analise.id)}/image`,
      );
      const imageUrl = URL.createObjectURL(blob);
      imagemUrlRef.current = imageUrl;
      setDetalhe({ ...analise, imagemDataUrl: imageUrl });
    } catch (cause) {
      setImagemError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a imagem guardada.",
      );
    } finally {
      setImagemLoading(false);
    }
  }

  function fecharDetalhe() {
    if (imagemUrlRef.current) URL.revokeObjectURL(imagemUrlRef.current);
    imagemUrlRef.current = null;
    setDetalhe(null);
    setImagemError(null);
  }

  async function confirmarEliminacao() {
    if (!session?.access_token || !confirmacaoEliminacao) return;
    setErroEliminacao(null);

    if (confirmacaoEliminacao.tipo === "historico") {
      setEliminandoTudo(true);
      try {
        await apiRequest<void>(session.access_token, "/analyses", {
          method: "DELETE",
        });
        setIdsEliminados(
          (current) =>
            new Set([...current, ...analisesVisiveis.map(({ id }) => id)]),
        );
        fecharDetalhe();
        setConfirmacaoEliminacao(null);
      } catch (cause) {
        setErroEliminacao(
          cause instanceof Error
            ? cause.message
            : "Não foi possível eliminar o histórico.",
        );
      } finally {
        setEliminandoTudo(false);
      }
      return;
    }

    const analise = confirmacaoEliminacao.analise;
    setEliminandoId(analise.id);
    try {
      await apiRequest<void>(
        session.access_token,
        `/analyses/${encodeURIComponent(analise.id)}`,
        { method: "DELETE" },
      );
      setIdsEliminados((current) => new Set([...current, analise.id]));
      if (detalhe?.id === analise.id) fecharDetalhe();
      setConfirmacaoEliminacao(null);
    } catch (cause) {
      setErroEliminacao(
        cause instanceof Error
          ? cause.message
          : "Não foi possível eliminar esta análise.",
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <AppLayout titulo="Histórico de Detecções" subtitulo={`${linhas.length} registos`} allowedRoles={["operador", "admin", "investigador"]}>
      <section className="panel p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por nome da imagem…"
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none [&>option]:bg-card"
          >
            <option value="todas">Todas as classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={exportarCsv}
            disabled={linhas.length === 0}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <Download className="size-4" /> Exportar CSV
          </button>
          <button
            onClick={exportarPdf}
            disabled={linhas.length === 0}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-accent disabled:opacity-40"
          >
            <FileDown className="size-4" /> Exportar PDF
          </button>
          {profile && ["operador", "admin"].includes(profile.role) ? (
            <button
              disabled={analisesVisiveis.length === 0 || eliminandoTudo}
              onClick={() => {
                setErroEliminacao(null);
                setConfirmacaoEliminacao({ tipo: "historico" });
              }}
              className="flex items-center gap-2 rounded-lg border border-destructive/60 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="size-4" /> Eliminar histórico
            </button>
          ) : null}
        </div>

        {loading ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            A carregar histórico real do banco de dados…
          </p>
        ) : null}
        {error || imagemError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error ?? imagemError}
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Data / Hora</th>
                <th className="py-2 pr-3 font-medium">Imagem</th>
                <th className="py-2 pr-3 font-medium">Classe</th>
                <th className="py-2 pr-3 font-medium">Confiança</th>
                <th className="py-2 pr-3 font-medium">Limiar</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ analise, det }, i) => (
                <tr key={`${analise.id}-${i}`} className="border-b border-border/60">
                  <td className="py-3 pr-3 text-muted-foreground">
                    {new Date(analise.criadoEm).toLocaleString("pt-PT")}
                  </td>
                  <td className="py-3 pr-3">{analise.nomeImagem}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`rounded-md border px-2 py-1 text-xs ${
                        det ? "border-destructive text-destructive" : "border-success text-success"
                      }`}
                    >
                      {det?.classe ?? "Nenhum Objeto"}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{det ? `${(det.confianca * 100).toFixed(1)}%` : "—"}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{analise.limiar.toFixed(2)}</td>
                  <td
                    className={`py-3 pr-3 ${det?.aceite ? "text-success" : "text-muted-foreground"}`}
                  >
                    {det ? (det.aceite ? "Aceite" : "Descartada") : "—"}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => void abrirDetalhe(analise)}
                        className="text-primary hover:underline"
                      >
                        Ver
                      </button>
                      {profile && ["operador", "admin"].includes(profile.role) ? (
                        <button
                          type="button"
                          title="Eliminar esta análise"
                          aria-label={`Eliminar análise ${analise.nomeImagem}`}
                          disabled={eliminandoId !== null}
                          onClick={() => {
                            setErroEliminacao(null);
                            setConfirmacaoEliminacao({
                              tipo: "individual",
                              analise,
                            });
                          }}
                          className="inline-flex items-center gap-1 text-destructive hover:underline disabled:opacity-50"
                        >
                          {eliminandoId === analise.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    Sem registos para os filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {erroEliminacao ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {erroEliminacao}
          </p>
        ) : null}
      </section>

      {detalhe ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={fecharDetalhe}
        >
          <div
            className="panel max-h-[85vh] w-full max-w-lg overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">{detalhe.nomeImagem}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(detalhe.criadoEm).toLocaleString("pt-PT")} · {detalhe.fps} FPS
            </p>
            {imagemLoading ? (
              <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                A carregar imagem privada…
              </p>
            ) : detalhe.imagemDataUrl ? (
              <DetectionCanvas
                src={detalhe.imagemDataUrl}
                deteccoes={detalhe.deteccoes}
                className="mt-4"
              />
            ) : imagemError ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {imagemError}
              </p>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                A imagem guardada não está disponível.
              </p>
            )}
            <ul className="mt-4 space-y-2 text-sm">
              {detalhe.deteccoes.map((d, i) => (
                <li key={i} className="flex justify-between border-b border-border/60 pb-2">
                  <span>{d.classe}</span>
                  <span>{(d.confianca * 100).toFixed(1)}%</span>
                  <span className={d.aceite ? "text-success" : "text-muted-foreground"}>
                    {d.aceite ? "Aceite" : "Descartada"}
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={fecharDetalhe}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
      {confirmacaoEliminacao ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            if (!eliminandoId && !eliminandoTudo)
              setConfirmacaoEliminacao(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-description"
            className="panel w-full max-w-md p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h2 id="confirm-delete-title" className="text-lg font-semibold">
                  {confirmacaoEliminacao.tipo === "historico"
                    ? "Eliminar histórico"
                    : "Eliminar análise"}
                </h2>
                <p
                  id="confirm-delete-description"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {confirmacaoEliminacao.tipo === "historico"
                    ? "Esta ação elimina permanentemente os registos e as imagens do histórico que tens permissão para gerir."
                    : `Eliminar permanentemente a análise "${confirmacaoEliminacao.analise.nomeImagem}" e a imagem guardada?`}
                </p>
              </div>
            </div>
            {erroEliminacao ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {erroEliminacao}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={eliminandoId !== null || eliminandoTudo}
                onClick={() => setConfirmacaoEliminacao(null)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminandoId !== null || eliminandoTudo}
                onClick={() => void confirmarEliminacao()}
                className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {eliminandoId !== null || eliminandoTudo ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {eliminandoTudo || eliminandoId !== null
                  ? "A eliminar…"
                  : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
