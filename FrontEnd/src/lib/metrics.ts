import type { Analise } from "./detection";
import { CLASSE_TIPO } from "./detection";

export function resumo(analises: Analise[]) {
  const totalImagens = analises.length;
  const aceites = analises.flatMap((a) => a.deteccoes.filter((d) => d.aceite));
  const alertas = analises.filter((a) => a.alerta).length;
  const confiancaMedia = aceites.length
    ? (aceites.reduce((s, d) => s + d.confianca, 0) / aceites.length) * 100
    : 0;
  const fpsMedio = totalImagens ? analises.reduce((s, a) => s + a.fps, 0) / totalImagens : 0;

  const fogo = aceites.filter((d) => CLASSE_TIPO[d.classe] === "fogo").length;
  const branca = aceites.filter((d) => CLASSE_TIPO[d.classe] === "branca").length;
  const ferramenta = aceites.filter(
    (d) => CLASSE_TIPO[d.classe] === "ferramenta",
  ).length;
  const desconhecida = aceites.filter(
    (d) => CLASSE_TIPO[d.classe] === "desconhecida",
  ).length;

  return {
    totalImagens,
    alertas,
    totalDeteccoes: aceites.length,
    confiancaMedia,
    fpsMedio,
    fogo,
    branca,
    ferramenta,
    desconhecida,
  };
}

export function porClasse(analises: Analise[]) {
  const mapa = new Map<string, number>();
  analises
    .flatMap((a) => a.deteccoes.filter((d) => d.aceite))
    .forEach((d) => mapa.set(d.classe, (mapa.get(d.classe) ?? 0) + 1));
  return Array.from(mapa, ([classe, total]) => ({ classe, total })).sort(
    (a, b) => b.total - a.total,
  );
}

export function serieDiaria(analises: Analise[], dias = 7) {
  const hoje = new Date();
  return Array.from({ length: dias }, (_, i) => {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() - (dias - 1 - i));
    const doDia = analises.filter(
      (a) => new Date(a.criadoEm).toDateString() === dia.toDateString(),
    );
    const deteccoes = doDia.flatMap((a) =>
      a.deteccoes.filter((d) => d.aceite),
    );
    return {
      dia: dia.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
      analises: doDia.length,
      deteccoes: deteccoes.length,
      confiancaMedia: deteccoes.length
        ? Number(
            (
              (deteccoes.reduce((sum, detection) => sum + detection.confianca, 0) /
                deteccoes.length) *
              100
            ).toFixed(1),
          )
        : 0,
    };
  });
}
