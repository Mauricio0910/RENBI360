# Roadmap para Produção

## Fase 1 — Mapeamento do ERP
- Levantar banco, tabelas, procedures e regras atuais.
- Definir conceito oficial de faturamento, venda, devolução, custo e estoque.
- Mapear IDs estáveis.
- Mapear plano de contas e centros de custos.

## Fase 2 — Integração
- Criar fila de sincronização no Delphi.
- Implementar autenticação segura.
- Implementar cadastros e vendas.
- Depois compras, estoque, despesas e contabilidade.
- Criar tela de monitoramento de integração.

## Fase 3 — Banco gerencial
- Persistir fatos e dimensões.
- Criar índices e restrições por empresa/filial.
- Criar agregações diárias/mensais.
- Automatizar reconciliação.

## Fase 4 — Indicadores
- Validar KPIs com Comercial, Financeiro e Controladoria.
- Criar parametrização por empresa.
- Criar metas e permissões.
- Exportação Excel/PDF e envio agendado.

## Fase 5 — Inteligência
- Forecast com backtesting.
- Sugestão de compra por lead time e sazonalidade.
- Detecção de anomalias.
- Alertas gerenciais.
- Oportunidades de mercado com dados externos reais.

## Fase 6 — Governança
- LGPD e retenção.
- Auditoria.
- Backup e disaster recovery.
- Observabilidade e SLA.
- Testes de carga e segurança.

## Critérios de aceite

Antes de publicar qualquer indicador como oficial:
- divergência faturamento ERP x BI <= tolerância aprovada;
- venda líquida reconciliada;
- estoque reconciliado por filial;
- contas a pagar/receber reconciliadas;
- DRE validada pela controladoria/contabilidade;
- logs de integração acessíveis;
- usuário só enxerga empresas/filiais autorizadas.
