// Emolumentos de registro de imóveis por UF, em faixas do valor declarado (tabelas oficiais de 2026).
// Cada tabela devolve o total pago pelo usuário em um registro (emolumento + fundos + selo, quando a
// tabela os informa). Prenotação, certidões e ISS municipal ficam de fora, salvo onde indicado.

export type RegistroEstimate = {
  valor: number;
  oficial: boolean;
  fonte: string;
  fonteUrl: string;
};

// compra: registro da compra e venda; garantia: registro da alienação fiduciária.
export type AtoRegistro = "compra" | "garantia";

const RI_DIGITAL_URL = "https://ridigital.org.br/ConsultaTaxas/EmolumentosEstado.aspx";

type Faixa = [limite: number, valor: number];

type UfTable = {
  fonte: string;
  fonteUrl: string;
  total: (base: number) => number;
  // Tabela própria para a alienação fiduciária, quando difere da compra e venda.
  garantia?: (base: number) => number;
  // Redução própria do SFH (primeiro imóvel); sem ela, aplica-se 50% sobre o total.
  sfh?: (base: number) => number;
};

// Valor da primeira faixa cujo limite alcança a base; acima da última, mantém o último valor.
function porFaixa(faixas: Faixa[], base: number) {
  const faixa = faixas.find(([limite]) => base <= limite);
  return (faixa ?? faixas[faixas.length - 1]!)[1];
}

// Quantidade de passos (ou fração) que a base excede um limite.
function passos(base: number, limite: number, passo: number) {
  return base > limite ? Math.ceil((base - limite) / passo) : 0;
}

// TJCE — Tabela VII, códigos 007001 a 007009 (vigência 02/01/2026, Portaria nº 2982/2025).
// Total = emolumento + FERMOJU (5%) + FAADEP (5%) + FRMMP (5%) + selo.
const CE_FAIXAS: Faixa[] = [
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
  if (base <= 55337.23) return porFaixa(CE_FAIXAS, base);
  // Acima da última faixa: R$ 0,217 a cada R$ 10,98 ou fração excedente, limitado a R$ 2.181,26.
  return 1985.32 + Math.min(passos(base, 55337.23, 10.98) * 0.217, 2181.26);
}

// TJSP — Tabela II, item 1. Total = oficial + Estado + Sefaz + Registro Civil + TJ + MP.
const SP: Faixa[] = [
  [2306, 257.2], [5761, 412.72], [9603, 740.42], [19210, 1098.57], [38420, 1335.6], [115260, 1489.46],
  [192100, 1901.09], [230520, 2311.88], [268940, 2516.87], [307360, 2723.02], [345780, 2870.61],
  [384200, 2945.43], [768400, 3284.18], [1152600, 3846.1], [1536800, 4427.79], [1921000, 5009.53],
  [2305200, 5310.3], [3842000, 6814.06], [5763000, 9520.82], [7684000, 12528.33], [9605000, 15535.85],
  [11526000, 18543.37], [13447000, 21550.88], [15368000, 24558.39], [17289000, 27565.91],
  [19210000, 30573.43],
];

// TJRJ — Tabela 05.1, item 1 (emolumento, sem o acréscimo de 2%).
const RJ: Faixa[] = [
  [21064.17, 327.23], [42128.37, 540.71], [63192.57, 754.28], [84256.79, 925.03], [112342.37, 1639.6],
  [140427.98, 1935.68], [280855.98, 2618.85], [561711.99, 2818.18],
];

function rjEmolumento(base: number) {
  // A partir de R$ 561.712,00, mais R$ 252,43 a cada nova faixa de R$ 140.427,98.
  return porFaixa(RJ, base) + passos(base, 561711.99, 140427.98) * 252.43;
}

// TJMG — Tabela 4, item 5.e. Valor final ao usuário = emolumentos + TFJ.
const MG: Faixa[] = [
  [1400, 220.55], [2720, 359.76], [5440, 521.35], [7000, 721.75], [14000, 962.47], [28000, 1243.47],
  [42000, 1564.07], [56000, 1925.31], [70000, 2326.51], [105000, 2928.06], [140000, 3721.52],
  [175000, 3979.69], [210000, 4238.32], [280000, 4772.07], [350000, 4903.53], [420000, 5035.59],
  [560000, 5523.14], [700000, 5826.7], [840000, 6130.87], [1120000, 6866.53], [1400000, 7437.64],
  [1680000, 8009.72], [3200000, 8582.97],
];

function mgTotal(base: number) {
  if (base <= 3200000) return porFaixa(MG, base);
  // Nota XVII: a cada R$ 500 mil ou fração (até 100 faixas), R$ 3.289,90 na 1ª e R$ 2.193,27 nas demais;
  // TFJ fixa de R$ 4.673,83.
  const faixas = Math.min(passos(base, 3200000, 500000), 100);
  return 4844.02 + 3289.9 + (faixas - 1) * 2193.27 + 4673.83;
}

// TJRS — Registro de Imóveis, item 1 (somente emolumentos).
const RS: Faixa[] = [
  [2481.8, 226.1], [4963.4, 230.8], [7445.2, 241], [9927, 251.1], [12408.7, 260.9], [14890.1, 271],
  [17371.5, 281.3], [19853.7, 291.3], [22335.1, 300.7], [24816.8, 310.4], [37225.2, 340.9], [49633.8, 390.8],
  [74451, 465.9], [99267.8, 565.5], [124085, 664.9], [148901.6, 764.7], [173718.6, 864.6], [198535.7, 964.2],
  [223352.7, 1064.2], [248169.5, 1163.9], [297803.6, 1313.3], [347437.3, 1512.3], [397071, 1712],
  [446705, 1911.3], [496338.9, 2111.7], [620424, 2460.8], [744508.5, 2958.9], [868593.3, 3458],
  [992677.9, 3956.2], [1116762.8, 4454.9], [1240847.6, 4953.6], [Infinity, 5482.9],
];

// TJSC — Tabela III, item 2.2. Total = emolumentos + FRJ + selo normal (R$ 3,86).
const SC: Faixa[] = [
  [13786.59, 203.48], [20679.87, 230.57], [28951.83, 327.02], [35845.12, 425.15], [44117.08, 530.07],
  [53767.69, 638.34], [62039.64, 750.03], [71690.25, 866.78], [79962.21, 988.6], [90991.48, 1113.81],
  [100642.09, 1244.1], [111671.36, 1381.16], [122700.64, 1504.66], [133729.9, 1629.88], [146137.83, 1758.48],
  [158545.76, 1888.77], [170953.69, 2020.74], [184740.27, 2154.4], [198526.88, 2291.46],
  [212313.47, 2430.21], [226100.05, 2570.64],
];

function scTotal(base: number) {
  // Item 2.2.22: mais R$ 50,00 de emolumento (e FRJ de 22,73%) a cada R$ 50 mil acima de R$ 226.100,05.
  return porFaixa(SC, base) + passos(base, 226100.05, 50000) * 50 * 1.2273;
}

// TJBA — Tabela III, item I (valor a pagar).
const BA: Faixa[] = [
  [1600, 333.34], [3200, 419.3], [8000, 505.24], [12000, 546.06], [16000, 587.62], [24000, 670.86],
  [32000, 756.26], [47000, 835.36], [63000, 920.54], [78000, 1010.84], [118000, 1076.62], [160000, 1164.82],
  [235000, 1885.66], [350000, 2828.84], [530000, 4248.68], [800000, 6371.4], [1200000, 9555.6],
  [1800000, 11466.66], [2700000, 14907], [4000000, 19379.08], [Infinity, 25192.9],
];

// TJES — Tabela 11, item I.B (emolumento; fundos de 25% somados no total).
const ES: Faixa[] = [
  [1000, 89.84], [3000, 111.21], [5000, 153.98], [10000, 228.84], [15000, 335.77], [20000, 442.73],
  [25000, 549.65], [30000, 656.58], [35000, 763.52], [40000, 870.45], [45000, 977.39], [50000, 1084.32],
  [55000, 1191.26], [60000, 1298.21], [65000, 1405.14], [70000, 1512.08], [75000, 1619.02], [80000, 1725.94],
  [85000, 1832.88], [90000, 1939.81], [95000, 2046.76], [100000, 2153.69], [105000, 2260.61],
  [110000, 2367.57], [115000, 2474.49], [120000, 2581.44], [125000, 2688.35], [130000, 2795.3],
  [140000, 2955.72], [150000, 3169.58], [160000, 3383.45], [170000, 3597.32], [180000, 3811.2],
  [200000, 4132.01], [Infinity, 4559.73],
];

// TJMS — Tabela III.C (compra e venda e alienação fiduciária). Total com FUNJECC, FUNADEP/FUNDE-PGE, FEADMP e selos.
const MS: Faixa[] = [
  [5000, 138.11], [10000, 250.5], [15000, 361.39], [20000, 473.64], [25000, 583.05], [30000, 693.8],
  [35000, 806.21], [40000, 917.1], [45000, 1029.48], [50000, 1140.26], [55000, 1363.53], [60000, 1474.31],
  [65000, 1586.69], [70000, 1696.1], [75000, 1806.85], [80000, 1917.75], [85000, 2030.15], [90000, 2140.89],
  [95000, 2253.21], [100000, 2474.94], [110000, 2584.65], [120000, 2696.73], [130000, 2807.51],
  [140000, 2918.38], [150000, 3029.14], [160000, 3121.51], [170000, 3213.87], [180000, 3306.24],
  [190000, 3398.63], [200000, 3491], [210000, 3580.36], [220000, 3669.59], [230000, 3758.96],
  [240000, 3848.2], [250000, 3937.43], [260000, 4100.63], [270000, 4263.85], [280000, 4427.06],
  [290000, 4590.26], [300000, 4753.33], [325000, 4831.95], [350000, 4910.43], [375000, 4988.88],
  [400000, 5067.49], [425000, 5146], [450000, 5224.44], [475000, 5303.05], [500000, 5381.52],
  [600000, 5459.99], [700000, 5538.47], [800000, 5617.07], [900000, 5695.54], [1000000, 5774.02],
  [2000000, 6172.36], [3000000, 6649.19], [4000000, 7126.02], [5000000, 7602.83], [7000000, 8079.66],
  [9000000, 8556.47], [Infinity, 9033.3],
];

function mtEmolumento(base: number) {
  // TJMT — Tabela C, item 27: R$ 115,65 até R$ 2.676,76; depois R$ 29,50 a cada R$ 1.338,53, até R$ 6.948,45.
  return Math.min(115.65 + passos(base, 2676.76, 1338.53) * 29.5, 6948.45);
}

// TJRO — Tabela III, código 302.a. Total = oficial + FUJU + FUNDIMPER + FUNDEP + FUMORPGE + selo.
const RO: Faixa[] = [
  [29684, 244.2], [39386, 454.79], [49085, 574.5], [58787, 687.7], [68487, 800.94], [78189, 914.17],
  [97591, 1140.59], [116992, 1336.98], [136393, 1523.43], [155797, 1699.99], [175198, 1866.63],
  [214000, 2224.98], [252804, 2563.56], [291609, 2882.38], [330410, 3181.54], [369214, 3461.02],
  [466223, 4251.43], [563231, 4992.66], [660238, 5684.85], [757248, 6328.07], [854256, 6778.37],
  [1048273, 7879.65], [1242289, 8815.91], [1436306, 9590.35], [1630323, 10203.51], [1824338, 10660.11],
  [2018358, 10956.55], [2212372, 11093.22], [2406393, 11345.01], [2600407, 11702.01], [2794424, 12145.84],
  [Infinity, 12589.62],
];

// TJTO — Tabela IV. Total = emolumentos + TFJ + FUNCIVIL.
const TO: Faixa[] = [
  [3000, 247.97], [6000, 498.73], [10000, 668.32], [20000, 924.8], [30000, 1437.79], [40000, 1865.28],
  [60000, 2292.76], [80000, 2788.64], [100000, 3077.18],
];
const TO_GARANTIA: Faixa[] = [
  [10000, 232.02], [20000, 355.12], [30000, 601.35], [40000, 847.61], [60000, 1216.93], [80000, 1832.52],
  [100000, 2203.27],
];

function toTotal(faixas: Faixa[], incremento: number, base: number) {
  // Acima de R$ 100 mil, soma-se a parcela a cada R$ 50 mil, limitada a R$ 15.932,83.
  return Math.min(porFaixa(faixas, base) + passos(base, 100000, 50000) * incremento, 15932.83);
}

// TJMA — item 16.3. Total = emolumentos + FERC + FADEP + FEMP + FERRFIS.
const MA: Faixa[] = [
  [5917.36, 111.11], [7692.57, 140.01], [9615.72, 158.55], [12019.65, 196.77], [15024.56, 244.66],
  [18780.69, 306.77], [23475.86, 384.85], [29344.81, 481.65], [36681.02, 599.84], [45851.29, 750.69],
  [57314.07, 939.28], [71642.58, 1173.09], [89553.26, 1466.33], [111941.56, 1832.33], [139926.94, 2289.78],
  [174908.66, 2862.74], [218635.83, 3578.55], [273294.81, 4474.29], [341618.5, 5590.81],
  [427023.14, 6989.72], [533778.91, 8736.26], [667223.64, 10920.44], [834029.56, 13651.34],
  [1042536.94, 16209.99], [1303171.21, 17299.63], [1563805.44, 17818.55], [1876566.51, 18353.16],
  [2251879.82, 18903.8], [2702255.82, 19470.93], [3242706.98, 20055.05], [3891248.37, 20656.61],
  [4669498.05, 21276.39], [5603397.67, 21914.57], [6724077.19, 22572.09], [8068892.63, 23249.22],
  [Infinity, 23946.65],
];

// TJAC — Tabela 1-A. Valor final = emolumentos + fundo de compensação + fundo de fiscalização.
const AC: Faixa[] = [
  [3000, 108.6], [5000, 201.7], [15000, 269.1], [30000, 403.2], [50000, 672.1], [80000, 1075.7],
  [100000, 1344.2], [150000, 2016.1], [200000, 2688.1], [250000, 3360.3], [300000, 4032.8], [350000, 4704.7],
  [400000, 5376.4], [500000, 6720.8], [Infinity, 8064.7],
];

// TJAP — Tabela 01-A. Total = emolumentos + TSNR + TFJ + FERC.
const AP: Faixa[] = [
  [3000, 224.4], [5000, 420.73], [15000, 560.97], [30000, 841.43], [50000, 1402.41], [80000, 2243.98],
  [100000, 2804.95], [150000, 4207.45], [200000, 5609.93], [250000, 7012.41], [300000, 8414.88],
  [350000, 9817.38], [400000, 11219.88], [500000, 14024.85], [1000000, 16829.84], [1500000, 19634.79],
  [Infinity, 22439.73],
];
// Código 71: registro de contrato de alienação fiduciária, valor fixo.
const AP_GARANTIA = 280.47;

// TJPA — Tabela III, item III (valores finais ao usuário).
const PA: Faixa[] = [
  [15000, 74.3], [30000, 124.6], [45000, 186.9], [60000, 249.3], [75000, 480.8], [90000, 712.4],
  [120000, 1094.4], [150000, 1476.4], [180000, 1858.6], [210000, 2382.9], [240000, 2907.2], [270000, 3431.6],
  [330000, 3956], [390000, 4277.4], [450000, 4598.9], [510000, 4920.3], [570000, 5241.8], [630000, 5563.2],
  [750000, 7994.9], [870000, 10426.5], [990000, 12858.3], [1110000, 13929.7], [1230000, 15001.2],
  [1350000, 16072.7], [1470000, 17144.2], [1590000, 18215.7], [1710000, 19287.2], [1830000, 20358.6],
  [1950000, 21430.1], [2070000, 22501.6], [2190000, 23573.1], [2310000, 24644.5], [2430000, 25716],
  [2550000, 26787.5], [2670000, 27859], [2790000, 28930.5], [2910000, 30301.7], [3030000, 31672.9],
  [3270000, 33044.2], [3510000, 34415.4], [3750000, 35786.7], [3990000, 37157.9], [4230000, 38529.1],
  [4470000, 39900.4], [4710000, 41271.6], [4950000, 42642.9], [5430000, 44014.1], [5910000, 45377.5],
  [6390000, 46740.9], [6870000, 48104.3], [Infinity, 49467.8],
];

// TJPI — Tabela IV, item 45. Valor = cartório + FERMOJUPI + MP + FMADPEP + FEAD.
const PI: Faixa[] = [
  [1424.36, 389.91], [2746.98, 436.47], [4171.34, 483.1], [5595.7, 529.57], [6918.32, 576.2],
  [9767.04, 669.38], [12514.02, 762.57], [16685.36, 855.73], [20856.7, 1050.42], [25028.04, 1245.12],
  [29199.38, 1439.81], [33370.72, 1634.48], [37542.06, 1830.38], [41713.4, 2024.01], [48631.72, 2299.51],
  [55550.04, 2575.02], [62468.36, 2850.58], [69488.42, 3126.09], [83325.06, 3267.61], [97263.44, 3409.11],
  [111100.08, 3550.63], [125038.46, 3568.69], [127175, 3686.75], [132262, 4015.24], [142436, 4373],
  [152610, 4762.63], [162784, 5186.98], [172958, 5649.13], [183132, 6152.47], [203480, 6700.65],
  [254350, 7297.7], [305220, 7947.9], [356090, 8656.08], [406960, 9427.32], [508700, 10267.29],
  [763050, 11182.13], [1017400, 12178.44], [1526100, 13263.54], [3052200, 14445.32], [6104400, 15732.4],
  [8139200, 17134.15], [10174000, 18660.8], [15261000, 20323.48], [20348000, 22134.3], [30522000, 24106.47],
  [40696000, 26254.36], [50870000, 28593.62], [Infinity, 31141.32],
];

// TJRN — Tabela VI.B. Total = emolumentos + FDJ + FRMP + FCRCPN + ISS 5% + FUNAF.
const RN: Faixa[] = [
  [10000, 191.22], [20000, 348.41], [30000, 427.01], [35065, 505.62], [40000, 516.19], [50000, 783.98],
  [60000, 935.38], [70000, 1090.65], [80000, 1242.05], [90000, 1397.31], [100000, 1548.66],
  [110000, 1672.69], [120000, 1780.42], [130000, 1888.19], [140000, 1995.91], [150000, 2103.64],
  [160000, 2256.2], [170000, 2408.72], [180000, 2561.25], [190000, 2713.8], [200000, 2866.34],
  [210000, 3052.1], [220000, 3221.57], [230000, 3391.03], [240000, 3560.5], [250000, 3729.97],
  [260000, 3882.9], [270000, 4035.83], [280000, 4188.77], [290000, 4341.72], [300000, 4494.64],
  [310000, 4679.57], [320000, 4848.25], [330000, 5016.89], [340000, 5185.56], [350000, 5354.23],
  [360000, 5507.16], [370000, 5660.11], [380000, 5813.04], [390000, 5965.96], [400000, 6118.91],
  [410000, 6304.26], [420000, 6473.33], [430000, 6642.41], [440000, 6811.48], [450000, 6980.57],
  [460000, 7133.48], [470000, 7286.42], [480000, 7439.35], [490000, 7592.29], [500000, 7745.23],
  [510000, 7930.14], [520000, 8098.83], [530000, 8267.49], [540000, 8436.14], [550000, 8604.82],
  [560000, 8757.74], [570000, 8910.66], [580000, 9063.61], [590000, 9216.53], [600000, 9369.47],
  [610000, 9508.64], [620000, 9631.32], [630000, 9754.01], [640000, 9876.7], [650000, 9999.38],
  [660000, 10122.05], [670000, 10244.75], [680000, 10367.42], [690000, 10490.12], [700000, 10612.78],
  [710000, 10765.72], [720000, 10918.65], [730000, 11071.59], [740000, 11224.52], [750000, 11377.47],
  [760000, 11530.39], [770000, 11683.3], [780000, 11836.25], [790000, 11989.18], [800000, 12142.12],
  [810000, 12294.86], [820000, 12447.59], [830000, 12600.33], [840000, 12753.03], [850000, 12905.81],
  [860000, 13058.54], [870000, 13211.27], [880000, 13364.02], [890000, 13516.73], [900000, 13669.46],
  [910000, 13822.4], [920000, 13975.34], [930000, 14128.28], [940000, 14281.22], [950000, 14434.14],
  [960000, 14587.09], [970000, 14740.01], [980000, 14892.97], [990000, 15045.9], [1000000, 15198.83],
  [1100000, 15504.49], [1200000, 15810.15], [1250000, 16930.6], [1300000, 16930.6], [1400000, 18051.07],
  [1500000, 19171.52], [1600000, 19859.53], [1700000, 20547.54], [1750000, 21057.29], [1800000, 21057.29],
  [1900000, 21567.09], [2000000, 22076.86], [2100000, 22175.45], [2200000, 22274.07], [2300000, 22372.65],
  [2400000, 22471.25], [2500000, 22569.86], [2600000, 22668.48], [2700000, 22767.08], [2800000, 22865.67],
  [2900000, 22964.28], [3000000, 23062.88], [3100000, 23161.47], [3200000, 23260.09], [3300000, 23358.7],
  [3400000, 23457.29], [3500000, 23555.88], [3600000, 23654.5], [3700000, 23753.1], [3800000, 23851.7],
  [3900000, 23950.31], [4000000, 24048.88], [4100000, 24147.51], [4200000, 24246.11], [4300000, 24344.73],
  [4400000, 24443.31], [4500000, 24541.91], [4600000, 24640.53], [4700000, 24739.11], [4800000, 24837.74],
  [4900000, 24936.33], [5000000, 25034.94], [Infinity, 25133.54],
];

// TJDFT — Tabela III, item 1. Total = emolumentos + CCRCPN.
const DF: Faixa[] = [
  [32844.44, 667.73], [82111.11, 843.44], [164222.21, 1019.16], [262755.54, 1142.17], [574777.74, 1317.88],
  [870377.72, 1493.61], [1149555.47, 1669.33], [1477999.89, 1845.05], [1970666.52, 2020.76],
  [Infinity, 2196.48],
];

// TJGO — Tabela XIV, item 76 (emolumento; fundos estaduais de 43% somados no total).
const GO: Faixa[] = [
  [653.8, 61.56], [1307.62, 93.32], [2615.24, 119.13], [5230.47, 172.76], [10460.94, 339.54],
  [15691.43, 363.35], [26152.37, 462.64], [39228.54, 585.76], [52304.74, 776.37], [65380.92, 923.29],
  [104609.47, 1294.6], [156914.21, 1945.88], [261523.68, 2620.98], [392285.51, 3441.04],
  [523047.35, 4054.59], [784571.03, 4866.7], [1176856.54, 5831.7], [1569142.07, 6780.81],
  [Infinity, 7407.33],
];

// TJPE — Tabela E, item IV (emolumento; a TSNR é somada no total).
const PE: Faixa[] = [
  [5000, 237.84], [6000, 334.88], [7000, 351], [8000, 367.15], [9000, 383.34], [10000, 399.5],
  [11000, 415.6], [12000, 431.87], [13000, 447.97], [14000, 464.17], [15000, 480.33], [16000, 496.47],
  [17000, 512.6], [18000, 528.81], [19000, 544.99], [20000, 561.13], [25000, 601.56], [30000, 682.37],
  [35000, 763.22], [40000, 844.01], [45000, 924.84], [50000, 1005.73], [55000, 1086.49], [60000, 1167.36],
  [65000, 1248.21], [70000, 1328.95], [75000, 1409.82], [80000, 1490.62], [85000, 1571.49], [90000, 1652.29],
  [95000, 1733.16], [100000, 1813.99], [105000, 1894.76], [110000, 1975.57], [115000, 2056.43],
  [120000, 2137.26], [125000, 2218.03], [130000, 2298.89], [135000, 2379.79], [140000, 2460.55],
  [145000, 2541.38], [150000, 2622.19], [155000, 2702.99], [160000, 2783.87], [165000, 2864.68],
  [170000, 2945.5], [175000, 3026.33], [180000, 3107.11], [185000, 3187.96], [190000, 3271.06],
  [195000, 3349.64], [200000, 3430.47], [205000, 3511.3], [210000, 3592.1], [215000, 3672.94],
  [220000, 3753.74], [225000, 3834.6], [230000, 3915.43], [235000, 3996.24], [240000, 4077.07],
  [245000, 4157.88], [250000, 4238.66], [255000, 4319.58], [260000, 4400.37], [265000, 4481.17],
  [270000, 4562.04], [275000, 4642.87], [278000, 4707.48], [Infinity, 4723.28],
];

function peTsnr(base: number, emolumento: number) {
  // Lei 11.404/96, art. 27: 0,2% até R$ 100 mil, 0,25% até R$ 300 mil e 0,3% acima,
  // entre R$ 6,59 e R$ 3.280,79 (valores 2026) e nunca acima do emolumento.
  const taxa = base <= 100000 ? 0.002 : base <= 300000 ? 0.0025 : 0.003;
  return Math.min(Math.max(base * taxa, 6.59), 3280.79, emolumento);
}

// TJPR — Tabela XIII, item XIII.b (somente emolumentos; tabela não progressiva).
const PR: Faixa[] = [
  [15512, 349.02], [18282, 411.34], [21052, 473.67], [23822, 535.99], [26592, 598.32], [29362, 660.64],
  [32132, 722.97], [34902, 785.29], [37672, 847.62], [40442, 909.94], [43212, 972.27], [45982, 1011.6],
  [48752, 1072.54], [51522, 1133.48], [54292, 1194.42], [Infinity, 1194.42],
];

function pbTotal(base: number) {
  // TJPB — Tabela H, item I; contribuição ao FARPEN (Anexo II) e selo especial (Anexo III).
  const emolumento =
    base <= 70980
      ? porFaixa([[17745, 124.22], [35490, 310.54], [49686, 496.86], [70980, 709.8]], base)
      : Math.min(709.8 + passos(base, 70980, 7098) * 53.24, 8872.5);
  const farpen =
    base <= 70980
      ? porFaixa([[17745, 53.25], [35490, 78.09], [49686, 106.48], [70980, 138.56]], base)
      : 155.59 + emolumento * 0.025;
  const selo = emolumento <= 394.56 ? 3.6 : emolumento <= 986.42 ? 7.21 : 18;
  return emolumento + farpen + selo;
}

// TJAM — Tabela II, item I. Total = emolumento + ISS 5% + FIG RCPN + Funjeam + selo + computação.
const AM: Faixa[] = [
  [17595, 646.06], [35190, 988.23], [58650, 1224.42], [117300, 1603.45], [234600, 2794.93],
  [351900, 4612.42], [469200, 7183.31], [586500, 9151.69], [703800, 11224.93], [821100, 11577.13],
  [938400, 12994.35], [1055700, 15303.81], [4055700, 17903.81], [7055700, 20503.81], [10055700, 23103.81],
  [13055700, 25703.81], [16055700, 28303.81], [19055700, 30903.81], [22055700, 33503.81],
  [25055700, 36103.81], [28055700, 38703.81], [31055700, 41303.81], [34055700, 43903.81],
  [37055700, 46503.81], [40055700, 49103.81], [43055700, 51703.81], [46055700, 54303.81],
  [49055700, 56903.81], [50000000, 59503.81], [Infinity, 59503.81],
];

// TJRR — Tabela G, item 1. Total = emolumento + FECOM + FUNDEJURR + selo.
const RR: Faixa[] = [
  [5000, 152.67], [10000, 204.87], [15000, 275.91], [20000, 371.59], [25000, 500.62], [30000, 674.6],
  [35000, 909.47], [50000, 1226.95], [100000, 1654.63], [200000, 2233.1], [300000, 3014.52],
  [Infinity, 4069.95],
];

// TJAL — código 200. Total = VE + TSNR (26%).
const AL: Faixa[] = [
  [2500, 225.06], [5000, 324.08], [7500, 550.44], [15000, 786.39], [25000, 1100.99], [35000, 1376.26],
  [45000, 1690.86], [60000, 2162.75], [75000, 2634.65], [90000, 3067.22], [120000, 4011.01],
  [150000, 4915.47], [200000, 5662.64], [250000, 6174.2], [300000, 6685.7], [450000, 7197.26],
  [600000, 7708.82], [750000, 8220.38], [1000000, 8731.94], [1500000, 9499.98], [2000000, 10266.62],
  [4000000, 11289.74], [6000000, 12312.86], [8000000, 13335.98], [10000000, 14359.1], [Infinity, 15382.22],
];

function seEmolumento(base: number) {
  // Lei 8.639/2019 (Anexo IV, item 2), com a regra de excedente da Lei 9.840/2025.
  if (base <= 25000) return porFaixa([[5999.99, 316.66], [12999.99, 513.01], [25000, 708.46]], base);
  const ate1085 = Math.ceil((Math.min(base, 1085000) - 25000) / 5000) * 47.06;
  const ate1200 = base > 1085000 ? 18.7 : 0;
  const acima = passos(base, 1200000, 100000) * 18.7;
  return Math.min(708.46 + ate1085 + ate1200 + acima, 11264.88);
}

const fixa = (faixas: Faixa[]) => (base: number) => porFaixa(faixas, base);

const TABLES: Partial<Record<string, UfTable>> = {
  AC: { fonte: "TJAC — Provimento COGER nº 15/2025, Tabela 1-A", fonteUrl: RI_DIGITAL_URL, total: fixa(AC) },
  AL: {
    fonte: "TJAL — Lei 9.778/2025, código 200 (sem ISS)",
    fonteUrl: "https://emolumentos.tjal.jus.br/atos-oficiais-registro-imoveis",
    total: fixa(AL),
  },
  AM: {
    fonte: "TJAM — Leis 7.500/2025 e 8.212/2026, Tabela II, item I",
    fonteUrl: "https://www.tjam.jus.br/index.php/ext-emolumentos/emolumentos-capital",
    total: fixa(AM),
  },
  AP: {
    fonte: "TJAP — Tabela 01-A 2026 (alienação fiduciária: código 71)",
    fonteUrl: RI_DIGITAL_URL,
    total: fixa(AP),
    garantia: () => AP_GARANTIA,
  },
  BA: { fonte: "TJBA — Tabela III 2026, item I", fonteUrl: RI_DIGITAL_URL, total: fixa(BA) },
  CE: {
    fonte: "TJCE — Tabela VII de emolumentos 2026",
    fonteUrl: "https://portal.tjce.jus.br/uploads/2026/01/Tab.-Emolumentos-2026.pdf",
    total: (base) => ceEmolumento(base) * 1.15 + CE_SELO,
  },
  DF: { fonte: "TJDFT — Tabela III 2026, item 1", fonteUrl: RI_DIGITAL_URL, total: fixa(DF) },
  ES: {
    fonte: "TJES — Ato CGJ nº 10/2025, Tabela 11 (+25% de fundos)",
    fonteUrl: RI_DIGITAL_URL,
    total: (base) => porFaixa(ES, base) * 1.25,
  },
  GO: {
    fonte: "TJGO — Tabela XIV 2026, item 76 (+43% de fundos, Lei 19.191/2015)",
    fonteUrl: RI_DIGITAL_URL,
    total: (base) => porFaixa(GO, base) * 1.43,
  },
  MA: { fonte: "TJMA — Tabela 2026/1, item 16.3", fonteUrl: RI_DIGITAL_URL, total: fixa(MA) },
  MG: { fonte: "TJMG — Tabela 4 2026, item 5.e", fonteUrl: RI_DIGITAL_URL, total: mgTotal },
  MS: { fonte: "TJMS — Tabela III.C 2026", fonteUrl: RI_DIGITAL_URL, total: fixa(MS) },
  MT: {
    fonte: "TJMT — Provimento nº 80/2025, Tabela C, item 27 (somente emolumentos)",
    fonteUrl: RI_DIGITAL_URL,
    total: mtEmolumento,
  },
  PA: { fonte: "TJPA — Tabela III 2026, item III", fonteUrl: RI_DIGITAL_URL, total: fixa(PA) },
  PB: {
    fonte: "TJPB — Ato CGJ nº 01/2025, Tabela H (com FARPEN e selo)",
    fonteUrl: "https://corregedoria.tjpb.jus.br/wp-content/uploads/2026/01/Tabela-de-Emolumentos-de-2026-CGJ.pdf",
    total: pbTotal,
  },
  PE: {
    fonte: "TJPE — Ato nº 1556/2025, Tabela E, item IV (+TSNR)",
    fonteUrl: "https://portal.tjpe.jus.br/documents/d/portal/ato-1556-tab-emolumentos-dj390-2025-pdf",
    total: (base) => {
      const emolumento = porFaixa(PE, base);
      return emolumento + peTsnr(base, emolumento);
    },
  },
  PI: { fonte: "TJPI — Tabela IV 2026, item 45", fonteUrl: RI_DIGITAL_URL, total: fixa(PI) },
  PR: {
    fonte: "TJPR — Lei 21.869/2023, Tabela XIII, item XIII.b (somente emolumentos)",
    fonteUrl: "https://extrajudicial.tjpr.jus.br/emolumentos",
    total: fixa(PR),
  },
  RJ: {
    fonte: "TJRJ — Portaria CGJ nº 516/2026, Tabela 05.1 (+48% de acréscimos e selo)",
    fonteUrl: "https://www.tjrj.jus.br/documents/d/cgj/portaria_n_516-26_cgj",
    total: (base) => rjEmolumento(base) * 1.48 + 3.27,
    // Nota 7: na primeira aquisição pelo SFH, 50% do emolumento e sem os fundos públicos.
    sfh: (base) => rjEmolumento(base) * 0.5 * 1.02 + 3.27,
  },
  RN: { fonte: "TJRN — Tabela VI.B 2026 (inclui ISS 5%)", fonteUrl: RI_DIGITAL_URL, total: fixa(RN) },
  RO: { fonte: "TJRO — Tabela III 2026, código 302.a", fonteUrl: RI_DIGITAL_URL, total: fixa(RO) },
  RR: {
    fonte: "TJRR — Provimento CGJ nº 5/2026, Tabela G, item 1",
    fonteUrl: "https://atos.tjrr.jus.br/atos/detalhar/8221",
    total: fixa(RR),
  },
  RS: { fonte: "TJRS — Tabela 2026, Registro de Imóveis, item 1 (somente emolumentos)", fonteUrl: RI_DIGITAL_URL, total: fixa(RS) },
  SC: { fonte: "TJSC — Tabela III 2026, item 2.2", fonteUrl: RI_DIGITAL_URL, total: scTotal },
  SE: {
    fonte: "TJSE — Lei 8.639/2019 e Lei 9.840/2025, Anexo IV, item 2 (somente emolumentos)",
    fonteUrl: "https://www.tjse.jus.br/portal/consultas/valores-das-custas-processuais",
    total: seEmolumento,
  },
  SP: { fonte: "TJSP — Tabela II 2026, item 1", fonteUrl: RI_DIGITAL_URL, total: fixa(SP) },
  TO: {
    fonte: "TJTO — Tabela IV 2026, itens 2.3 (compra) e 2.2 (garantia)",
    fonteUrl: RI_DIGITAL_URL,
    total: (base) => toTotal(TO, 149.49, base),
    garantia: (base) => toTotal(TO_GARANTIA, 35.47, base),
  },
};

const FALLBACK_RATE = 0.005;

export function hasOfficialRegistryTable(uf: string) {
  return Boolean(TABLES[uf]);
}

// Art. 290 da Lei 6.015/73: 50% de redução no primeiro imóvel residencial financiado pelo SFH,
// tanto no registro da compra e venda quanto no da garantia.
export function registroEstimate(uf: string, base: number, primeiroImovelSfh: boolean, ato: AtoRegistro = "compra"): RegistroEstimate {
  const table = TABLES[uf];
  if (!table) {
    return {
      valor: Math.max(base, 0) * FALLBACK_RATE * (primeiroImovelSfh ? 0.5 : 1),
      oficial: false,
      fonte: "Estimativa de 0,5% — tabela da UF ainda não cadastrada",
      fonteUrl: RI_DIGITAL_URL,
    };
  }
  if (base <= 0) return { valor: 0, oficial: true, fonte: table.fonte, fonteUrl: table.fonteUrl };
  const total = (ato === "garantia" && table.garantia) || table.total;
  const valor = primeiroImovelSfh ? (table.sfh ? table.sfh(base) : total(base) * 0.5) : total(base);
  return { valor: Math.round(valor * 100) / 100, oficial: true, fonte: table.fonte, fonteUrl: table.fonteUrl };
}
