import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { NumericInput } from "@/components/app/NumericInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BRL, NUMBER, type SistemaAmortizacao } from "@/lib/finance";
import { COMPROMETIMENTO_RENDA, jurosSugeridos, faixaPorRenda, preAnalise } from "@/lib/pre-analise";

export const Route = createFileRoute("/_authenticated/pre-analise")({
  head: () => ({
    meta: [
      { title: "Quanto o cliente consegue | Sinal Verde da Obra" },
      { name: "description", content: "Pré-análise pela renda: financiamento, valor do imóvel e área estimados antes do simulador da Caixa." },
      { property: "og:title", content: "Quanto o cliente consegue" },
      { property: "og:description", content: "Pré-análise pela renda antes do simulador da Caixa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreAnalise,
});

const MOTIVO = {
  renda: "A renda é o limite: a prestação já usa 30% dela. Mais entrada não aumenta o imóvel.",
  entrada: "A entrada é o limite: o banco financia até 80%, então o cliente precisa de 20% em terreno próprio, FGTS ou dinheiro. Mais entrada aumenta o imóvel até o limite da renda.",
  faixa: "O teto do imóvel da faixa é o limite. Acima dele o cliente sai desta faixa do programa e a taxa sobe.",
} as const;

function PreAnalise() {
  const [rendaFormal, setRendaFormal] = useState(0);
  const [rendaInformal, setRendaInformal] = useState(0);
  const [idade, setIdade] = useState(30);
  const [cotistaFgts, setCotistaFgts] = useState(false);
  const [fgts, setFgts] = useState(0);
  const [dinheiro, setDinheiro] = useState(0);
  const [terreno, setTerreno] = useState(0);
  const [terrenoProprio, setTerrenoProprio] = useState(true);
  const [custoM2, setCustoM2] = useState(0);
  const [sistema, setSistema] = useState<SistemaAmortizacao>("PRICE");
  const [jurosManual, setJurosManual] = useState<number | null>(null);
  const [seguroTarifa, setSeguroTarifa] = useState(100);
  const r = useMemo(
    () => preAnalise({ rendaFormal, rendaInformal, idade, cotistaFgts, fgts, dinheiro, terreno, terrenoProprio, sistema, jurosAnuais: jurosManual, seguroTarifaMensal: seguroTarifa, custoM2 }),
    [rendaFormal, rendaInformal, idade, cotistaFgts, fgts, dinheiro, terreno, terrenoProprio, sistema, jurosManual, seguroTarifa, custoM2],
  );
  const jurosFaixa = jurosSugeridos(faixaPorRenda(rendaFormal + rendaInformal), cotistaFgts);
  const pronto = r.renda > 0 && r.prazo > 0 && r.valorImovel > 0;
  const field = (label: string, value: number, set: (n: number) => void, opts: { monetary?: boolean; decimals?: number; help?: string } = {}) => (
    <div>
      <Label>{label}</Label>
      <NumericInput className="mt-2 h-11" value={value} decimals={opts.decimals ?? 2} monetary={opts.monetary ?? true} onValueChange={set} />
      {opts.help && <p className="mt-1.5 text-xs text-muted-foreground">{opts.help}</p>}
    </div>
  );
  return (
    <AppShell>
      <p className="text-sm font-semibold text-primary">PRÉ-ANÁLISE PELA RENDA</p>
      <h1 className="mt-2 text-3xl font-bold">Quanto o cliente consegue?</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Uma estimativa rápida antes do simulador da Caixa: quanto o banco pode financiar pela renda, qual imóvel cabe e quanto de casa dá para construir.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
            {field("Renda formal da família (bruta)", rendaFormal, setRendaFormal, { help: "Salário, pró-labore, aposentadoria: soma de quem vai assinar." })}
            {field("Renda informal comprovável", rendaInformal, setRendaInformal, { help: "Comprovada por extrato; o banco pode aceitar só uma parte." })}
            {field("Idade do participante mais velho", idade, setIdade, { monetary: false, decimals: 0, help: "Idade + prazo não passam de 80 anos e 6 meses." })}
            {field("Saldo de FGTS", fgts, setFgts)}
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm sm:col-span-2">
              <Checkbox className="mt-0.5" checked={cotistaFgts} onCheckedChange={(checked) => setCotistaFgts(checked === true)} />
              <span>Tem 3 anos ou mais de trabalho com FGTS (desconto de 0,5 ponto na taxa nas faixas 1 a 3)</span>
            </label>
            {field("Dinheiro guardado para a entrada", dinheiro, setDinheiro)}
            {field("Valor do terreno", terreno, setTerreno)}
            <div className="sm:col-span-2">
              <Label>O terreno</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([[true, "Já é do cliente (quitado)"], [false, "Vai ser comprado"]] as const).map(([valor, rotulo]) => (
                  <Button key={rotulo} type="button" variant={terrenoProprio === valor ? "default" : "outline"} className="h-auto whitespace-normal py-2.5" onClick={() => setTerrenoProprio(valor)}>{rotulo}</Button>
                ))}
              </div>
            </div>
            {field("Custo da obra por m² (opcional)", custoM2, setCustoM2, { help: "Mão de obra + materiais, para estimar a área." })}
            <div>
              <Label>Sistema de amortização</Label>
              <select className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={sistema} onChange={(e) => setSistema(e.target.value as SistemaAmortizacao)}>
                <option value="PRICE">PRICE (parcela fixa)</option>
                <option value="SAC">SAC (parcela decrescente)</option>
              </select>
            </div>
            <div>
              <Label>Taxa de juros nominal anual (%)</Label>
              <NumericInput className="mt-2 h-11" value={jurosManual ?? jurosFaixa} decimals={2} onValueChange={setJurosManual} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {jurosManual === null ? `Sugerida para ${r.faixa.rotulo}.` : <button type="button" className="underline" onClick={() => setJurosManual(null)}>Usar a taxa da faixa ({NUMBER.format(jurosFaixa)}%)</button>}
              </p>
            </div>
            {field("Seguros e tarifa por mês", seguroTarifa, setSeguroTarifa, { help: "Estimativa; o simulador da Caixa mostra o valor exato." })}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{r.faixa.rotulo}</span>
                <span className="text-xs text-muted-foreground">Juros {NUMBER.format(r.jurosAnuais)}% a.a. ({NUMBER.format(r.jurosEfetivos)}% efetivos) · {r.prazo} meses</span>
              </div>
              {!r.renda ? (
                <p className="mt-6 text-muted-foreground">Informe a renda da família para ver a estimativa.</p>
              ) : r.prazo === 0 ? (
                <p className="mt-6 text-destructive">Pela idade informada não há prazo de financiamento: idade + prazo precisam caber em 80 anos e 6 meses.</p>
              ) : (
                <>
                  <p className="mt-6 text-sm text-muted-foreground">Imóvel possível (terreno + obra)</p>
                  <p className="text-4xl font-bold">{BRL.format(r.valorImovel)}</p>
                  {r.area > 0 && <p className="mt-1 text-muted-foreground">cerca de <strong className="text-foreground">{NUMBER.format(Math.floor(r.area))} m²</strong> de casa com {BRL.format(r.verbaObra)} para a obra</p>}
                  <dl className="mt-6 grid gap-3 text-sm">
                    <Linha rotulo="Financiamento do banco" valor={r.financiamento} />
                    <Linha rotulo="Entrada" valor={r.entrada} />
                    {r.agioNaEntrada > 0 && <Linha rotulo="— terreno próprio" valor={r.agioNaEntrada} sub />}
                    {r.fgtsNaEntrada > 0 && <Linha rotulo="— FGTS" valor={r.fgtsNaEntrada} sub />}
                    {r.dinheiroNaEntrada > 0 && <Linha rotulo="— dinheiro" valor={r.dinheiroNaEntrada} sub />}
                    {r.terrenoNaOperacao > 0 && <Linha rotulo="Terreno pago ao vendedor na operação" valor={r.terrenoNaOperacao} />}
                    <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-3">
                      <dt className="min-w-0 font-semibold">{sistema === "SAC" ? "Primeira prestação (depois diminui)" : "Prestação depois da obra"}</dt>
                      <dd className="whitespace-nowrap font-semibold">{BRL.format(r.prestacao)}</dd>
                    </div>
                    <p className="text-xs text-muted-foreground">Limite de {COMPROMETIMENTO_RENDA * 100}% da renda: {BRL.format(r.parcelaMaxima)} por mês. Durante a obra o cliente paga só juros, seguros e tarifa.</p>
                  </dl>
                </>
              )}
            </CardContent>
          </Card>
          {pronto && (
            <Card>
              <CardContent className="space-y-3 p-6 text-sm leading-relaxed">
                <p><strong>O que limita:</strong> {MOTIVO[r.limitadoPor]}</p>
                {r.limitadoPor !== "renda" && r.capacidade > r.financiamento && (
                  <p className="text-muted-foreground">Pela renda, o banco financiaria até {BRL.format(r.capacidade)}.</p>
                )}
                <p className="text-muted-foreground">{r.faixa.observacao}</p>
                {r.terrenoMaiorQueImovel && <p className="text-destructive">O terreno vale mais do que o imóvel possível: não sobra verba para a obra.</p>}
                {r.loteAcimaDoLimiteBanco && <p className="text-amber-400">O banco quita o lote comprado até 30% do contrato; o que passar disso sai da entrada.</p>}
                {rendaInformal > 0 && <p className="text-muted-foreground">A renda informal depende de comprovação; sem ela o valor cai.</p>}
                {fgts > 0 && <p className="text-muted-foreground">FGTS só para o primeiro imóvel residencial do titular na cidade, com 3 anos de trabalho com FGTS somados.</p>}
                <p className="text-muted-foreground">A área não desconta documentação, impostos e juros da obra, e o cliente precisa de dinheiro para começar (cerca de 10% da obra), que volta com as medições. A simulação completa calcula tudo isso.</p>
                <Button asChild className="mt-2 w-full">
                  <Link
                    to="/simulacao/nova"
                    search={{
                      renda: r.renda,
                      credito: Math.round(r.financiamento * 100) / 100,
                      valorImovel: Math.round(r.valorImovel * 100) / 100,
                      fgts: Math.round(r.fgtsNaEntrada * 100) / 100,
                      terreno,
                      lote: terrenoProprio ? "proprio" : "compra",
                      juros: Math.round(r.jurosEfetivos * 100) / 100,
                      prazoFin: r.prazo,
                      sistema,
                      seguro: seguroTarifa,
                    }}
                  >
                    Levar para uma nova simulação <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Estimativa com as regras do Minha Casa, Minha Vida aprovadas em 24/03/2026 e taxas de referência. Não é aprovação de crédito: o valor final depende da análise do banco, do score, das dívidas e da avaliação do imóvel.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Linha({ rotulo, valor, sub = false }: { rotulo: string; valor: number; sub?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${sub ? "pl-3 text-muted-foreground" : ""}`}>
      <dt className="min-w-0">{rotulo}</dt>
      <dd className="whitespace-nowrap">{BRL.format(valor)}</dd>
    </div>
  );
}
