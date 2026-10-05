import type { CSSProperties } from "react";
import { CalendarClock, FileText, HardHat, KeyRound, PenLine, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRL, NUMBER } from "@/lib/finance";

// Proposta para o cliente que vai morar: linguagem simples, sem margem do construtor e pronta para imprimir.
// A folha tem fundo claro próprio para sair igual na tela e no PDF, independentemente do tema do app.

export type PropostaData = {
  nome: string;
  areaMin: number;
  areaMax: number;
  areaPlanejada: number;
  renda: number;
  custos: { terreno: number; construcao: number; documentos: number; juros: number };
  pagamento: { banco: number; fgts: number; terreno: number; bolso: number };
  folgaBanco: number;
  aporteArea: number;
  antesContrato: number;
  assinatura: number;
  caixaInicio: number;
  mesesObra: number;
  encargoInicial: number;
  encargoFinal: number;
  prestacao: number;
  sistema: "PRICE" | "SAC";
  prazoMeses: number;
};

const LIMITE_RENDA = 30;
const printExact: CSSProperties = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const m2 = (value: number) => `${NUMBER.format(value)} m²`;
const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

const FONTES = [
  { key: "banco", rotulo: "Financiamento do banco", cor: "#10b981" },
  { key: "fgts", rotulo: "Seu FGTS", cor: "#0ea5e9" },
  { key: "terreno", rotulo: "Terreno que já é seu", cor: "#8b5cf6" },
  { key: "bolso", rotulo: "Do seu bolso", cor: "#f59e0b" },
] as const;

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-zinc-200 p-5">
      <h2 className="text-base font-bold text-zinc-900">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Casa desenhada que "se enche" com as cores de quem paga cada parte, de baixo para cima.
function CasaQueSeEnche({ pagamento }: { pagamento: PropostaData["pagamento"] }) {
  const total = FONTES.reduce((sum, fonte) => sum + Math.max(pagamento[fonte.key], 0), 0);
  const topo = 12;
  const base = 172;
  let y = base;
  const faixas = FONTES.map((fonte) => {
    const altura = total > 0 ? (Math.max(pagamento[fonte.key], 0) / total) * (base - topo) : 0;
    y -= altura;
    return { ...fonte, y, altura };
  });
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
      <svg viewBox="0 0 200 180" className="mx-auto w-44" role="img" aria-label="Como o valor da casa é dividido entre banco, FGTS, terreno e seu bolso">
        <defs>
          <clipPath id="casa">
            <path d="M100 12 L188 80 L170 80 L170 172 L30 172 L30 80 L12 80 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#casa)">
          <rect x="0" y="0" width="200" height="180" fill="#f4f4f5" />
          {faixas.map((faixa) => faixa.altura > 0 && <rect key={faixa.key} x="0" y={faixa.y} width="200" height={faixa.altura} fill={faixa.cor} />)}
        </g>
        <rect x="86" y="128" width="28" height="44" rx="3" fill="#ffffff" fillOpacity="0.55" />
        <rect x="46" y="100" width="26" height="22" rx="3" fill="#ffffff" fillOpacity="0.55" />
        <rect x="128" y="100" width="26" height="22" rx="3" fill="#ffffff" fillOpacity="0.55" />
        <path d="M100 12 L188 80 L170 80 L170 172 L30 172 L30 80 L12 80 Z" fill="none" stroke="#18181b" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <ul className="space-y-2 text-sm">
        {FONTES.filter((fonte) => pagamento[fonte.key] > 0.005).map((fonte) => (
          <li key={fonte.key} className="flex items-center gap-3">
            <span className="size-3.5 shrink-0 rounded-sm" style={{ backgroundColor: fonte.cor }} />
            <span className="flex-1 text-zinc-600">{fonte.rotulo}</span>
            <span className="font-semibold text-zinc-900">{BRL.format(pagamento[fonte.key])}</span>
            <span className="w-10 text-right text-xs text-zinc-500">{total > 0 ? pct((pagamento[fonte.key] / total) * 100) : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Régua com a faixa de área que cabe no orçamento e a casa planejada.
function ReguaArea({ areaMin, areaMax, areaPlanejada }: Pick<PropostaData, "areaMin" | "areaMax" | "areaPlanejada">) {
  const fim = Math.max(areaMax, areaPlanejada) * 1.15 || 1;
  const pos = (value: number) => `${Math.min((value / fim) * 100, 100)}%`;
  return (
    <div>
      <div className="relative h-4 rounded-full bg-zinc-100">
        <div className="absolute inset-y-0 rounded-full bg-emerald-200" style={{ left: pos(areaMin), right: `calc(100% - ${pos(areaMax)})` }} />
        <div className="absolute -top-1.5 h-7 w-1 -translate-x-1/2 rounded-full bg-zinc-900" style={{ left: pos(areaPlanejada) }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>0 m²</span>
        <span>Cabe no orçamento: {m2(areaMin)} a {m2(areaMax)}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-700">Sua casa planejada: <strong className="text-zinc-900">{m2(areaPlanejada)}</strong></p>
    </div>
  );
}

function Semaforo({ status, titulo, texto }: { status: "verde" | "amarelo" | "vermelho"; titulo: string; texto: string }) {
  const luzes = [
    { key: "vermelho", cor: "#ef4444" },
    { key: "amarelo", cor: "#f59e0b" },
    { key: "verde", cor: "#10b981" },
  ] as const;
  return (
    <div className="flex items-center gap-5">
      <div className="flex shrink-0 flex-col gap-1.5 rounded-2xl bg-zinc-900 p-2">
        {luzes.map((luz) => (
          <span key={luz.key} className="size-6 rounded-full" style={{ backgroundColor: luz.cor, opacity: luz.key === status ? 1 : 0.18 }} />
        ))}
      </div>
      <div>
        <p className="text-lg font-bold text-zinc-900">{titulo}</p>
        <p className="mt-1 text-sm text-zinc-600">{texto}</p>
      </div>
    </div>
  );
}

function LinhaDoTempo({ data }: { data: PropostaData }) {
  const passos = [
    { icone: FileText, titulo: "Antes do contrato", valor: data.antesContrato, texto: "Projetos, alvará e certidões" },
    { icone: PenLine, titulo: "Na assinatura", valor: data.assinatura, texto: "Entrada em dinheiro, taxas e cartório" },
    {
      icone: HardHat,
      titulo: `Obra · ${data.mesesObra} meses`,
      valor: data.caixaInicio,
      texto: `${data.caixaInicio > 0.005 ? "Caixa para começar (volta com as medições). " : ""}Parcela de obra de ${BRL.format(data.encargoInicial)} a ${BRL.format(data.encargoFinal)} por mês`,
    },
    { icone: KeyRound, titulo: "Chaves na mão", valor: 0, texto: "Obra concluída e averbada" },
    { icone: CalendarClock, titulo: "Prestação", valor: data.prestacao, texto: data.sistema === "SAC" ? `Primeira parcela, depois diminui · ${data.prazoMeses} meses` : `Parcela fixa · ${data.prazoMeses} meses` },
  ];
  return (
    <ol className="grid gap-4 md:grid-cols-5">
      {passos.map((passo, index) => (
        <li key={passo.titulo} className="relative flex gap-3 md:flex-col md:items-center md:text-center">
          {index < passos.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-1.75rem)] w-0.5 bg-emerald-200 md:left-[calc(50%+1.5rem)] md:top-5 md:h-0.5 md:w-[calc(100%-2rem)]" />}
          <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <passo.icone className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{passo.titulo}</p>
            {passo.valor > 0.005 && <p className="text-base font-bold text-emerald-700">{BRL.format(passo.valor)}{passo.icone === CalendarClock ? "/mês" : ""}</p>}
            <p className="mt-0.5 text-xs text-zinc-500">{passo.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PrestacaoRenda({ prestacao, renda }: { prestacao: number; renda: number }) {
  const percentual = renda > 0 ? (prestacao / renda) * 100 : 0;
  const cor = percentual <= LIMITE_RENDA ? "#10b981" : "#ef4444";
  return (
    <div>
      <div className="relative h-5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(percentual, 100)}%`, backgroundColor: cor }} />
        <div className="absolute inset-y-0 w-0.5 bg-zinc-900" style={{ left: `${LIMITE_RENDA}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>Prestação {BRL.format(prestacao)} · {percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da renda</span>
        <span>Limite do banco: {LIMITE_RENDA}%</span>
      </div>
      <p className="mt-2 text-sm text-zinc-700">Renda informada: <strong className="text-zinc-900">{BRL.format(renda)}</strong> por mês.</p>
      <p className="mt-1 text-xs text-zinc-500">Como no simulador da Caixa, a parcela não inclui a TR, que varia e pode alterar um pouco o valor.</p>
    </div>
  );
}

export function PropostaCliente({ data }: { data: PropostaData }) {
  const custoTotal = data.custos.terreno + data.custos.construcao + data.custos.documentos + data.custos.juros;
  const comprometimento = data.renda > 0 ? (data.prestacao / data.renda) * 100 : 0;
  const status: "verde" | "amarelo" | "vermelho" = comprometimento > LIMITE_RENDA ? "vermelho" : data.aporteArea > 0.005 ? "amarelo" : "verde";
  const sinal = {
    verde: { titulo: "Sinal verde!", texto: "A casa planejada cabe no orçamento e a prestação fica dentro do que o banco aceita." },
    amarelo: { titulo: "Sinal amarelo", texto: `A casa cabe, mas precisa de ${BRL.format(data.aporteArea)} a mais do seu bolso para chegar a ${m2(data.areaPlanejada)}.` },
    vermelho: { titulo: "Sinal vermelho", texto: `A prestação passa de ${LIMITE_RENDA}% da renda; o banco tende a não aprovar. Vale reduzir a casa ou o financiamento.` },
  }[status];
  const custos = [
    { rotulo: "Construção da casa", valor: data.custos.construcao, cor: "#10b981" },
    { rotulo: "Terreno", valor: data.custos.terreno, cor: "#8b5cf6" },
    { rotulo: "Documentos e taxas", valor: data.custos.documentos, cor: "#0ea5e9" },
    { rotulo: "Juros durante a obra", valor: data.custos.juros, cor: "#f59e0b" },
  ].filter((item) => item.valor > 0.005);

  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <Button type="button" onClick={() => window.print()}>
          <Printer />
          Imprimir ou salvar PDF
        </Button>
      </div>
      <article className="mx-auto max-w-4xl space-y-5 rounded-3xl bg-white p-6 text-zinc-900 shadow-sm md:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none" style={printExact}>
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Proposta · Sinal Verde da Obra</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">{data.nome}</h1>
          </div>
          <p className="text-sm text-zinc-500">{new Date().toLocaleDateString("pt-BR")}</p>
        </header>

        <Semaforo status={status} titulo={sinal.titulo} texto={sinal.texto} />

        <div className="grid gap-5 md:grid-cols-2">
          <Bloco titulo="Quanto custa a sua casa">
            <p className="text-3xl font-bold">{BRL.format(custoTotal)}</p>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full">
              {custos.map((item) => <span key={item.rotulo} style={{ width: `${(item.valor / custoTotal) * 100}%`, backgroundColor: item.cor }} />)}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {custos.map((item) => (
                <li key={item.rotulo} className="flex items-center gap-3">
                  <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: item.cor }} />
                  <span className="flex-1 text-zinc-600">{item.rotulo}</span>
                  <span className="font-semibold">{BRL.format(item.valor)}</span>
                </li>
              ))}
            </ul>
          </Bloco>
          <Bloco titulo="Quem paga cada parte">
            <CasaQueSeEnche pagamento={data.pagamento} />
            {data.folgaBanco > 0.005 && <p className="mt-4 text-xs text-zinc-500">O seu crédito ainda tem folga de {BRL.format(data.folgaBanco)} para imprevistos ou para ampliar a casa.</p>}
          </Bloco>
        </div>

        <Bloco titulo="O tamanho da casa">
          <ReguaArea areaMin={data.areaMin} areaMax={data.areaMax} areaPlanejada={data.areaPlanejada} />
        </Bloco>

        <Bloco titulo="Quando você vai precisar de dinheiro">
          <LinhaDoTempo data={data} />
        </Bloco>

        {data.prestacao > 0.005 && data.renda > 0 && (
          <Bloco titulo="A prestação depois da obra cabe na renda?">
            <PrestacaoRenda prestacao={data.prestacao} renda={data.renda} />
          </Bloco>
        )}

        <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
          Estimativa para planejamento, sujeita à análise de crédito e à avaliação do banco. Valores de cartório, prefeitura e seguros podem variar.
        </footer>
      </article>
    </div>
  );
}
