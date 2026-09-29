// Emolumentos de registro de imóveis por UF, em faixas do valor declarado.
// Cada tabela devolve o total pago pelo usuário (emolumento + fundos + selo) de um registro.

export type RegistroEstimate = {
  valor: number;
  oficial: boolean;
  fonte: string;
  fonteUrl: string;
};

const RI_DIGITAL_URL = "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx";

type UfTable = {
  fonte: string;
  fonteUrl: string;
  total: (base: number) => number;
};

// TJCE — Tabela VII, códigos 007001 a 007009 (vigência 02/01/2026, Portaria nº 2982/2025).
// Total = emolumento + FERMOJU (5%) + FAADEP (5%) + FRMMP (5%) + selo.
const CE_FAIXAS: [limite: number, emolumento: number][] = [
  [6917.21, 472.51],
  [13836.91, 518.4],
  [20754.3, 744.48],
  [27673.83, 992.65],
  [34580.79, 1240.8],
  [41335.37, 1488.97],
  [48417.57, 1737.14],
  [55337.23, 1985.32],
];
const CE_SELO = 56.83;

function ceEmolumento(base: number) {
  const faixa = CE_FAIXAS.find(([limite]) => base <= limite);
  if (faixa) return faixa[1];
  // Acima da última faixa: R$ 0,217 a cada R$ 10,98 ou fração excedente, limitado a R$ 2.181,26.
  const excedente = Math.min(Math.ceil((base - 55337.23) / 10.98) * 0.217, 2181.26);
  return 1985.32 + excedente;
}

const TABLES: Partial<Record<string, UfTable>> = {
  CE: {
    fonte: "TJCE — Tabela VII de emolumentos 2026",
    fonteUrl: "https://portal.tjce.jus.br/uploads/2026/01/Tab.-Emolumentos-2026.pdf",
    total: (base) => ceEmolumento(base) * 1.15 + CE_SELO,
  },
};

const FALLBACK_RATE = 0.005;

export function hasOfficialRegistryTable(uf: string) {
  return Boolean(TABLES[uf]);
}

// Art. 290 da Lei 6.015/73: 50% de redução no primeiro imóvel residencial financiado pelo SFH,
// tanto no registro da compra e venda quanto no da garantia.
export function registroEstimate(uf: string, base: number, primeiroImovelSfh: boolean): RegistroEstimate {
  const table = TABLES[uf];
  const fator = primeiroImovelSfh ? 0.5 : 1;
  if (!table) {
    return {
      valor: Math.max(base, 0) * FALLBACK_RATE * fator,
      oficial: false,
      fonte: "Estimativa de 0,5% — tabela da UF ainda não cadastrada",
      fonteUrl: RI_DIGITAL_URL,
    };
  }
  if (base <= 0) return { valor: 0, oficial: true, fonte: table.fonte, fonteUrl: table.fonteUrl };
  return { valor: Math.round(table.total(base) * fator * 100) / 100, oficial: true, fonte: table.fonte, fonteUrl: table.fonteUrl };
}
