export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export type Extra = { descricao: string; valor: number }
export type Stage = { nome: string; percentual: number }
export type SimulationInput = {
  credito: number; cub: number; bdi: number; extras: Extra[]; objetivo: 'morar' | 'vender';
  valorVenda: number; prazo: number; juros: number; stages: Stage[]
}

export function calculate(input: SimulationInput) {
  const extrasTotal = input.extras.reduce((sum, item) => sum + Number(item.valor || 0), 0)
  const contingencia = input.credito * 0.2
  const disponivel = Math.max(0, input.credito - extrasTotal - contingencia)
  const custoM2 = input.cub * (1 + input.bdi / 100)
  const areaViavel = custoM2 > 0 ? disponivel / custoM2 : 0
  const custoObra = areaViavel * custoM2 + extrasTotal
  const jurosObra = input.credito * (input.juros / 100) * input.prazo
  const cenarios = [-0.15, 0, 0.15].map((ajuste, i) => ({
    nome: ['Pessimista', 'Realista', 'Otimista'][i],
    ajuste,
    venda: input.objetivo === 'vender' ? input.valorVenda * (1 + ajuste) : input.credito * (1 + ajuste),
    saldo: (input.objetivo === 'vender' ? input.valorVenda * (1 + ajuste) : input.credito * (1 + ajuste)) - custoObra - jurosObra,
  }))
  return { areaViavel, custoM2, extrasTotal, contingencia, disponivel, custoObra, jurosObra, cenarios, cronograma: input.stages.map(s => ({...s, valor: input.credito * s.percentual / 100})) }
}
