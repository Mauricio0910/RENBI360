# RenBI 360 v1.2 — Módulo de Projeções

## Objetivo
O módulo transforma o histórico recente do ERP em uma visão prospectiva para apoiar decisões comerciais e financeiras.

## Horizontes de vendas
- Semana: projeção de vendas dos próximos 7 dias e comparação com meta semanal.
- Mês: projeção de fechamento mensal.
- Ano: projeção anual com tendência e sazonalidade.

## Consolidação financeira
O painel calcula receita, despesas/custos, resultado e margem projetada para:
- mês;
- trimestre;
- semestre;
- ano.

## Cenários
1. Conservador: retração de vendas e menor absorção dos custos fixos.
2. Realista: continuidade do ritmo atual, com tendência e sazonalidade.
3. Otimista: aceleração comercial com melhoria de eficiência de custos.

## Metodologia padrão
A API usa como referência o run-rate móvel de 30 dias e separa custos fixos e variáveis. A projeção considera tendência mensal, sazonalidade, eficiência de custos e conversão de receitas em caixa. Em produção, os percentuais devem ser parametrizáveis por empresa/filial.

## Endpoint
`GET /api/v1/projections/overview?period=30d&granularity=month&reference=2026-08`

## Integração Delphi
A unit `UManager360Api.pas` inclui `GetSalesProjection`, retornando JSON com cenários, horizontes de venda, projeções consolidadas, caixa, premissas e insights.

## Exportação
O módulo participa da exportação geral do RenBI e suas tabelas podem ser exportadas isoladamente em Excel ou PDF.
