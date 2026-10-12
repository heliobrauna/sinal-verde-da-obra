import { CalendarClock, HardHat, Landmark, PenLine, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRL, NUMBER } from "@/lib/finance";
import type { RelatorioInvestidorData } from "@/lib/relatorio-investidor";
import { Bloco, Semaforo, printExact } from "./PropostaCliente";

// Relatório para o investidor da obra para venda: linguagem simples, só o lado dele, pronto para imprimir.
// Folha clara própria, igual na tela e no PDF.

const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function sinal(data: RelatorioInvestidorData) {
  const rende = data.rentabilidade === null ? "" : `rende ${pct(data.rentabilidade)} ao ano`;
  if (data.status === "verde") return { titulo: "Sinal verde!", texto: `Na venda esperada, seu dinheiro ${rende}, acima da Selic líquida (${pct(data.selicLiquida)}), e continua acima mesmo com a venda 10% mais barata ou 6 meses depois.` };
  if (data.status === "amarelo") return { titulo: "Sinal amarelo", texto: `Na venda esperada, seu dinheiro ${rende}, acima da Selic líquida (${pct(data.selicLiquida)}). Se a venda sair mais barata ou atrasar, pode render menos que ela: veja os cenários abaixo.` };
  return { titulo: "Sinal vermelho", texto: `Na venda esperada, seu dinheiro ${rende ? rende + "," : "rende"} menos que a Selic líquida (${pct(data.selicLiquida)}). Vale rever o preço, o prazo ou a divisão antes de entrar.` };
}

function LinhaDoTempo({ data }: { data: RelatorioInvestidorData }) {
  const passos = [
    { icone: PenLine, titulo: "Na assinatura", valor: data.fases.assinatura, texto: data.devolvidoFimObra > 0.005 ? `Despesas, caixa para começar a obra (volta no fim da obra: ${BRL.format(data.devolvidoFimObra)})` : "Despesas do contrato e caixa para começar" },
    { icone: HardHat, titulo: `Obra · ${data.mesesObra} meses`, valor: data.fases.obra, texto: "Juros da obra e o que a obra custar além do financiamento, mês a mês" },
    ...(data.mesVenda > data.mesesObra ? [{ icone: CalendarClock, titulo: `Até vender · ${data.mesVenda - data.mesesObra} meses`, valor: data.fases.aposObra, texto: "Parcelas do financiamento até a venda" }] : []),
    { icone: Landmark, titulo: `Venda · mês ${data.mesVenda}`, valor: data.recebeNaVenda, texto: "Você recebe o capital de volta e a sua parte do lucro", destaque: true },
  ];
  return (
    <ol className="grid gap-4 @3xl:grid-cols-4">
      {passos.map((passo, index) => (
        <li key={passo.titulo} className="relative flex gap-3 @3xl:flex-col @3xl:items-center @3xl:text-center">
          {index < passos.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-1.75rem)] w-0.5 bg-sky-200 @3xl:left-[calc(50%+1.5rem)] @3xl:top-5 @3xl:h-0.5 @3xl:w-[calc(100%-2rem)]" />}
          <span className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-white ${"destaque" in passo ? "bg-emerald-500" : "bg-sky-500"}`}>
            <passo.icone className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{passo.titulo}</p>
            {passo.valor > 0.005 && <p className={`text-base font-bold ${"destaque" in passo ? "text-emerald-700" : "text-sky-700"}`}>{"destaque" in passo ? "" : "− "}{BRL.format(passo.valor)}</p>}
            <p className="mt-0.5 text-xs text-zinc-500">{passo.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Barras comparando o rendimento da operação com o retorno mínimo combinado e a Selic líquida.
function Comparacao({ data }: { data: RelatorioInvestidorData }) {
  const barras = [
    { rotulo: "Esta operação", valor: data.rentabilidade ?? 0, cor: "#10b981" },
    { rotulo: "Retorno mínimo combinado", valor: data.taxaMinima, cor: "#0ea5e9" },
    { rotulo: "Tesouro Selic (líquido de IR)", valor: data.selicLiquida, cor: "#a1a1aa" },
  ];
  const maximo = Math.max(...barras.map((barra) => barra.valor), 1);
  return (
    <ul className="space-y-3">
      {barras.map((barra) => (
        <li key={barra.rotulo}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 text-zinc-600">{barra.rotulo}</span>
            <span className="shrink-0 whitespace-nowrap font-semibold text-zinc-900">{pct(barra.valor)} ao ano</span>
          </div>
          <div className="mt-1 h-3 rounded-full bg-zinc-100">
            <div className="h-3 rounded-full" style={{ width: `${Math.max((barra.valor / maximo) * 100, 2)}%`, backgroundColor: barra.cor }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RelatorioInvestidor({ data }: { data: RelatorioInvestidorData }) {
  const { titulo, texto } = sinal(data);
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
            <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Proposta de investimento · Sinal Verde da Obra</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">{data.nome}</h1>
            <p className="mt-1 text-sm text-zinc-500">Casa de {NUMBER.format(data.area)} m² para venda · preço esperado {BRL.format(data.precoVenda)} no mês {data.mesVenda}</p>
          </div>
          <p className="text-sm text-zinc-500">{new Date().toLocaleDateString("pt-BR")}</p>
        </header>

        <Semaforo status={data.status} titulo={titulo} texto={texto} />

        <div className="grid gap-5 md:grid-cols-2">
          <Bloco titulo="Quanto você precisa ter">
            <p className="text-3xl font-bold">{BRL.format(data.capitalMaximo)}</p>
            <p className="mt-1 text-sm text-zinc-600">É o máximo de dinheiro seu aplicado ao mesmo tempo. Ele não sai todo de uma vez: entra em etapas e uma parte volta no fim da obra.</p>
            {data.terreno > 0.005 && <p className="mt-3 rounded-xl bg-sky-50 p-3 text-xs text-zinc-600">Seu terreno também entra na operação, valendo {BRL.format(data.terreno)} (o que você receberia vendendo-o hoje). Ele volta para você na venda, junto com o capital.</p>}
          </Bloco>
          <Bloco titulo="Quanto você recebe">
            <p className="text-3xl font-bold text-emerald-700">{BRL.format(data.recebeNaVenda)}</p>
            <p className="mt-1 text-sm text-zinc-600">Na venda, no mês {data.mesVenda}: o seu capital de volta e {BRL.format(data.lucro)} de lucro.</p>
            <div className="mt-4">
              <Comparacao data={data} />
            </div>
          </Bloco>
        </div>

        <Bloco titulo="Quando o dinheiro entra e sai">
          <LinhaDoTempo data={data} />
        </Bloco>

        <div className="grid gap-5 md:grid-cols-2">
          <Bloco titulo="Como o lucro é dividido">
            <ol className="space-y-2 text-sm text-zinc-600">
              <li><strong className="text-zinc-900">1. Seu capital volta primeiro.</strong> Antes de qualquer divisão.</li>
              <li><strong className="text-zinc-900">2. Você recebe o retorno mínimo.</strong> {pct(data.taxaMinima)} ao ano sobre o seu capital, pelo tempo que ele ficar aplicado.</li>
              <li><strong className="text-zinc-900">3. O que sobrar é dividido.</strong> {pct(data.participacao)} para você.</li>
            </ol>
            <p className="mt-3 text-xs text-zinc-500">Ter você como parceiro não aumenta o preço da casa: o preço é o do mercado e o lucro é dividido a partir dele.</p>
          </Bloco>
          <Bloco titulo="E se a venda não sair como esperado?">
            <ul className="space-y-2 text-sm">
              {data.cenarios.map((c) => (
                <li key={c.nome} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-zinc-600">{c.nome} <span className="text-xs text-zinc-400">(mês {c.mesVenda})</span></span>
                  <span className="shrink-0 whitespace-nowrap text-right">
                    <strong className={c.lucro < 0 ? "text-red-600" : "text-zinc-900"}>{BRL.format(c.lucro)}</strong>
                    {c.rentabilidade !== null && <span className={`block text-xs ${c.rentabilidade >= data.selicLiquida ? "text-emerald-700" : "text-red-600"}`}>{pct(c.rentabilidade)} ao ano</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              O preço pode cair até {pct(data.folgaRetornoMinimo)} antes de você deixar de receber o retorno mínimo, e até {pct(data.folgaPrejuizo)} antes de perder dinheiro.
            </p>
          </Bloco>
        </div>

        <Bloco titulo="O que você precisa saber">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
            <li>O financiamento fica no seu nome (CPF), e o imóvel é a garantia do banco até ser vendido e quitado.</li>
            {data.parcelaAtraso > 0.005 && <li>Se a venda atrasar, as parcelas continuam: cerca de {BRL.format(data.parcelaAtraso)} por mês, já contadas no cenário de atraso.</li>}
            <li>{data.entradaDepositada ? "A agência exige depositar a entrada na assinatura; o que a obra não usar volta no fim da obra." : "A entrada exigida pelo banco é comprovação de recursos: você aplica só o que a obra realmente pedir, nas datas acima."}</li>
            <li>A Selic, o preço de venda e o prazo podem mudar; os valores são estimativas para decidir com segurança.</li>
          </ul>
        </Bloco>

        <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
          Estimativa para planejamento, sujeita à análise de crédito do banco, ao mercado e aos custos reais da obra. Rendimentos comparados com a Selic líquida de IR no mesmo prazo.
        </footer>
      </article>
    </div>
  );
}
