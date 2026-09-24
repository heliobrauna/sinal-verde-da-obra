# Plano — Ajustes do simulador e custos complementares

## Experiência da simulação
- Aplicar máscara brasileira a todos os campos monetários, percentuais e quantidades, com ponto para milhares e vírgula para decimais, sem controles laterais de incremento.
- Renomear “Crédito aprovado” para “Valor financiado (simulador Caixa)” e “Juros de obra ao mês (%)” para “Juros nominais (% - simulador Caixa)”.
- Mover juros nominais para “Orçamento sem surpresa”, atualizando imediatamente a estimativa de área viável.
- Iniciar “Custos fora do CUB” com Piscina, Paisagismo, Cerca elétrica, Motor para portão e Painéis solares, todos sem valor.
- Permitir excluir uma simulação pelo painel e pela página de resultado, sempre com confirmação.

## CUB oficial
- Consultar no servidor a publicação mais recente do CUB/m² Estadual da CBIC/Sinduscon para a UF escolhida.
- Usar o projeto residencial unifamiliar correspondente ao padrão selecionado: R1-B, R1-N ou R1-A, sem desoneração.
- Mostrar valor, competência, projeto-padrão e fonte no campo bloqueado “CUB por m²”.
- Manter um fallback seguro para a última referência salva quando a fonte oficial estiver temporariamente indisponível, identificando claramente a competência utilizada.

## Despesas e resultado
- Adicionar na etapa final os campos Projetos, Administração do processo e Honorários desejados; honorários não aparecem para construção destinada à moradia.
- Criar o total estimado das despesas do cliente, somado ao cálculo de viabilidade, com uma janela de detalhamento editável.
- Organizar a janela em despesas iniciais, assinatura do contrato e durante a obra, cobrindo todos os itens solicitados.
- Pré-calcular os itens possíveis a partir dos dados informados: entrada e saldo de honorários, taxa Caixa, produtos de relacionamento, vistorias, ITBI do lote e estimativas proporcionais. Itens municipais, previdenciários e cartorários permanecerão editáveis e serão marcados como estimativas variáveis.
- Exibir fontes oficiais ou institucionais junto dos itens tabelados e explicar quando o valor real depende do município, cartório, conselho profissional ou enquadramento previdenciário.
- Persistir o detalhamento no resultado da simulação e apresentá-lo na página final.

## Validação
- Conferir cálculos, máscaras, exclusão, bloqueio do CUB e persistência.
- Testar o fluxo completo em computador e celular, incluindo a janela de despesas e indisponibilidade da consulta oficial.
