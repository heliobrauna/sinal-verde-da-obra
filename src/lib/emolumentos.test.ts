import { describe, expect, it } from "vitest";
import { hasOfficialRegistryTable, registroEstimate } from "./emolumentos";

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

describe("emolumentos de registro por UF", () => {
  it("tem tabela oficial cadastrada para todas as UFs", () => {
    for (const uf of UFS) expect(hasOfficialRegistryTable(uf)).toBe(true);
    expect(registroEstimate("XX", 100000, false).oficial).toBe(false);
  });

  // Registro de R$ 300 mil, conferido nas tabelas oficiais de 2026.
  it.each([
    ["AC", 4032.8],
    ["AL", 6685.7],
    ["AM", 4612.42],
    ["AP", 8414.88],
    ["BA", 2828.84],
    ["DF", 1317.88],
    ["ES", 5699.66], // 4.559,73 + 25% de fundos
    ["GO", 4920.69], // 3.441,04 + 43% de fundos
    ["MA", 5590.81],
    ["MG", 4903.53],
    ["MS", 4753.33],
    ["MT", 6694.15], // 115,65 + 223 × 29,50
    ["PA", 3956],
    ["PB", 2701.98], // 2.466,72 + FARPEN 217,26 + selo 18,00
    ["PE", 5473.28], // 4.723,28 + TSNR de 0,25%
    ["PI", 7947.9],
    ["PR", 1194.42],
    ["RJ", 4174.18], // 2.818,18 × 1,48 + selo
    ["RN", 4494.64],
    ["RO", 3181.54],
    ["RR", 3014.52],
    ["RS", 1512.3],
    ["SC", 2693.37], // 2.570,64 + 2 × R$ 50 com FRJ
    ["SE", 3296.76], // 708,46 + 55 × 47,06
    ["SP", 2723.02],
    ["TO", 3675.14], // 3.077,18 + 4 × 149,49
  ])("%s", (uf, esperado) => {
    expect(registroEstimate(uf, 300000, false).valor).toBeCloseTo(esperado, 2);
  });

  it("usa a tabela própria da alienação fiduciária quando a UF tem uma", () => {
    expect(registroEstimate("AP", 300000, false, "garantia").valor).toBeCloseTo(280.47, 2);
    expect(registroEstimate("TO", 300000, false, "garantia").valor).toBeCloseTo(2345.15, 2);
    expect(registroEstimate("SP", 300000, false, "garantia").valor).toBeCloseTo(2723.02, 2);
  });

  it("aplica as regras acima da última faixa e os tetos", () => {
    // MG, nota XVII: R$ 3,5 mi = 1ª faixa excedente.
    expect(registroEstimate("MG", 3500000, false).valor).toBeCloseTo(4844.02 + 3289.9 + 4673.83, 2);
    // RJ: R$ 600 mil = uma faixa de R$ 140.427,98 acima de R$ 561.712,00.
    expect(registroEstimate("RJ", 600000, false).valor).toBeCloseTo((2818.18 + 252.43) * 1.48 + 3.27, 2);
    expect(registroEstimate("MT", 5000000, false).valor).toBeCloseTo(6948.45, 2);
    expect(registroEstimate("SE", 5000000, false).valor).toBeCloseTo(11264.88, 2);
    expect(registroEstimate("PB", 5000000, false).valor).toBeCloseTo(8872.5 + 155.59 + 8872.5 * 0.025 + 18, 2);
  });

  it("aplica o desconto do SFH, com a regra própria do RJ", () => {
    expect(registroEstimate("SP", 300000, true).valor).toBeCloseTo(2723.02 / 2, 2);
    // RJ, nota 7: 50% do emolumento, sem fundos públicos.
    expect(registroEstimate("RJ", 300000, true).valor).toBeCloseTo(2818.18 * 0.5 * 1.02 + 3.27, 2);
  });
});
