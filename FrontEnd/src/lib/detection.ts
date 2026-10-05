export type WeaponClass =
  "Arma de fogo" | "Faca" | "Alicate" | "Tesoura" | "Chave inglesa";
export type DetectionClass = WeaponClass | "Objeto desconhecido";

export type Detection = {
  classe: DetectionClass;
  confianca: number; // 0..1
  box: { x: number; y: number; w: number; h: number }; // normalized 0..1
  aceite: boolean;
};

export type Analise = {
  id: string;
  nomeImagem: string;
  imagemDataUrl: string;
  criadoEm: string; // ISO
  limiar: number;
  fps: number;
  tempoMs: number;
  deteccoes: Detection[];
  alerta: boolean;
};

export const CLASSES: WeaponClass[] = [
  "Arma de fogo",
  "Faca",
  "Alicate",
  "Tesoura",
  "Chave inglesa",
];

export const CLASSE_TIPO: Record<string, "fogo" | "branca"> = {
  "Arma de fogo": "fogo",
  Faca: "branca",
  Alicate: "branca",
  Tesoura: "branca",
  "Chave inglesa": "branca",
};

const CLASSES_NORMALIZADAS: Record<string, WeaponClass> = {
  armadefogo: "Arma de fogo",
  firearm: "Arma de fogo",
  gun: "Arma de fogo",
  pistol: "Arma de fogo",
  pistola: "Arma de fogo",
  faca: "Faca",
  knife: "Faca",
  alicate: "Alicate",
  pliers: "Alicate",
  tesoura: "Tesoura",
  scissors: "Tesoura",
  chaveinglesa: "Chave inglesa",
  wrench: "Chave inglesa",
  spanner: "Chave inglesa",
};

export function traduzirClasse(nome: string): DetectionClass {
  const chave = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return CLASSES_NORMALIZADAS[chave] ?? "Objeto desconhecido";
}

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Motor de inferência simulado (YOLOv8 demo).
 * Determinístico por nome/tamanho da imagem para resultados reprodutíveis.
 */
export function inferir(seedKey: string, limiar: number) {
  const rand = mulberry32(hashString(seedKey));
  const total = rand() < 0.18 ? 0 : 1 + Math.floor(rand() * 2);

  const deteccoes: Detection[] = [];
  for (let i = 0; i < total; i++) {
    const classe =
      CLASSES[Math.floor(rand() * CLASSES.length)] ?? "Arma de fogo";
    const confianca = Number((0.45 + rand() * 0.53).toFixed(4));
    const w = 0.16 + rand() * 0.24;
    const h = 0.12 + rand() * 0.2;
    const x = 0.06 + rand() * (0.9 - w);
    const y = 0.08 + rand() * (0.85 - h);
    deteccoes.push({
      classe,
      confianca,
      box: { x, y, w, h },
      aceite: confianca >= limiar,
    });
  }

  const tempoMs = Math.round(40 + rand() * 45);
  return {
    deteccoes,
    tempoMs,
    fps: Number((1000 / tempoMs).toFixed(1)),
    alerta: deteccoes.some((d) => d.aceite),
  };
}

export const preprocessSteps = [
  {
    label: "Leitura da imagem RX",
    detail: "Carregamento e validação do ficheiro",
  },
  {
    label: "Redimensionamento 640×640",
    detail: "Letterbox mantendo proporção",
  },
  { label: "Normalização", detail: "Pixels escalados para [0, 1]" },
  { label: "Conversão de formato", detail: "RGB → tensor NCHW float32" },
  { label: "Inferência YOLOv8", detail: "Forward pass + NMS" },
  { label: "Aplicação do limiar", detail: "Filtragem por confiança mínima" },
];
