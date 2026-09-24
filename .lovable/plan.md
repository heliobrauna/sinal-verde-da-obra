# Plano — Sinal Verde da Obra

## Objetivo
Construir o aplicativo completo descrito no documento: cadastro e acesso, simulações de viabilidade, resultados, bônus, perfil e gestão administrativa.

## Experiência do usuário
- Criar telas públicas de entrada e cadastro com acesso imediato após o registro.
- Montar a área autenticada com menu lateral no computador e navegação inferior no celular.
- Implementar o assistente de simulação em quatro etapas, validações claras e campos condicionais.
- Calcular área viável, custos fora do CUB, reserva, BDI, cronograma de sete etapas e cenários pessimista, realista e otimista.
- Permitir salvar, listar, reabrir e comparar visualmente os resultados das próprias simulações.
- Exibir os três bônus bloqueados até o oitavo dia e liberar o download depois.
- Criar perfil com dados da conta e troca de senha.

## Administração
- Painel com usuários, atividade, simulações e crédito médio.
- Busca, filtros, paginação e gestão de acesso/status dos usuários.
- Detalhe do usuário e suas simulações.
- Gestão mensal dos valores de CUB e dos três materiais de bônus.

## Dados e segurança
- Usar Lovable Cloud para cadastro, banco e arquivos.
- Manter dados pessoais em perfis e permissões em uma tabela separada, evitando elevação indevida de acesso.
- Aplicar isolamento por usuário em todas as simulações e validação administrativa no servidor.
- Criar automaticamente o perfil e conceder administração somente ao primeiro cadastro.
- Ativar cadastro por e-mail e senha sem confirmação por e-mail, conforme solicitado.

## Direção visual
- Tema escuro técnico e preciso, inspirado em Linear e Mercury.
- Verde como ação/viabilidade e dourado como alerta ou destaque financeiro.
- Space Grotesk nos títulos e Inter nos textos.
- Estados de carregamento, vazio, erro e sucesso em português, sem emojis.

## Validação final
- Conferir cálculos e regras de acesso.
- Testar os fluxos principais em computador e celular.
- Verificar cadastro, login, criação e abertura de simulação e restrição administrativa.
