import { NUMBER } from "@/lib/finance";
import { montarProposta } from "@/lib/proposta";
import { resumoProposta, type SinalProposta } from "@/components/app/PropostaCliente";
import type { Tables } from "@/integrations/supabase/types";

// No card os valores vão sem centavos para caber; o detalhe fica na página da simulação.
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type ResumoResultado = {
  areaViavel?: number;
  areaViavelMinima?: number;
  areaViavelMaxima?: number;
  areaPlanejada?: number;
  custoTotal?: number;
  custoComTerreno?: number;
  valorVenda?: number;
  lucroDesejado?: number;
};

const SINAL: Record<SinalProposta, { rotulo: string; classe: string }> = {
  verde: { rotulo: "Sinal verde", classe: "bg-emerald-500/15 text-emerald-400" },
  amarelo: { rotulo: "Sinal amarelo", classe: "bg-amber-500/15 text-amber-400" },
  vermelho: { rotulo: "Sinal vermelho", classe: "bg-red-500/15 text-red-400" },
};

// Resumo do card: área, os números que o construtor confere primeiro e o sinal da proposta (morar).
export function ResumoSimulacao({ item }: { item: Tables<"simulacoes"> }) {
  const r = item.resultado as ResumoResultado;
  const areaMin = r.areaViavelMinima ?? r.areaViavel ?? 0;
  const areaMax = r.areaViavelMaxima ?? r.areaViavel ?? 0;
  const faixa = areaMin === areaMax ? `${NUMBER.format(areaMin)} m²` : `${NUMBER.format(areaMin)} a ${NUMBER.format(areaMax)} m²`;
  const planejada = r.areaPlanejada && r.areaPlanejada > 0 ? r.areaPlanejada : 0;
  const custoComTerreno = r.custoComTerreno ?? (r.custoTotal !== undefined ? r.custoTotal + item.terreno_valor : undefined);
  const proposta = montarProposta(item);
  const resumo = proposta ? resumoProposta(proposta) : null;
  const numeros: { rotulo: string; valor: string; detalhe?: string | undefined }[] = [];
  if (item.objetivo === "vender") {
    if (r.valorVenda) numeros.push({ rotulo: "Venda estimada", valor: BRL.format(r.valorVenda) });
    if (custoComTerreno) numeros.push({ rotulo: "Custo total", valor: BRL.format(custoComTerreno) });
    const lucro = r.lucroDesejado ?? item.lucro_desejado ?? 0;
    if (lucro) numeros.push({ rotulo: "Lucro", valor: BRL.format(lucro) });
  } else if (proposta && resumo) {
    numeros.push({ rotulo: "Custo total", valor: BRL.format(resumo.custoTotal) });
    numeros.push({ rotulo: "Do bolso", valor: BRL.format(proposta.pagamento.bolso) });
    numeros.push({ rotulo: "Prestação", valor: BRL.format(proposta.prestacao), detalhe: proposta.renda > 0 ? `${NUMBER.format(Math.round(resumo.comprometimento))}% da renda` : undefined });
  } else if (custoComTerreno) {
    numeros.push({ rotulo: "Custo total", valor: BRL.format(custoComTerreno) });
  }
  return (
    <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{planejada ? "Área planejada" : "Área viável"}</p>
          <p className="mt-1 text-2xl font-bold">{planejada ? `${NUMBER.format(planejada)} m²` : faixa}</p>
          {planejada > 0 && <p className="text-xs text-muted-foreground">Cabem {faixa}</p>}
        </div>
        {resumo && <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${SINAL[resumo.status].classe}`}>{SINAL[resumo.status].rotulo}</span>}
      </div>
      {numeros.length > 0 && (
        <div className="@container mt-5 border-t pt-4">
          <dl className="grid gap-2 @sm:grid-cols-3 @sm:gap-3">
            {numeros.map((n) => (
              <div key={n.rotulo} className="flex items-baseline justify-between gap-3 @sm:block">
                <dt className="text-xs text-muted-foreground">{n.rotulo}</dt>
                <dd className="whitespace-nowrap text-right text-sm font-semibold @sm:mt-0.5 @sm:text-left">
                  {n.valor}
                  {n.detalhe && <span className="ml-1.5 text-xs font-normal text-muted-foreground @sm:ml-0 @sm:block">{n.detalhe}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
