# REN-BI 360 v1.5 — Mapeamento das Views SQL Server

## Objetivo

A integração SQL do REN-BI passa a usar uma **camada de Views canônicas**. O objetivo é impedir que a aplicação fique dependente dos nomes internos de tabelas e colunas do ERP.

A regra é simples:

1. O desenvolvedor mapeia as tabelas reais **somente nas Views Base**.
2. As Views Analíticas usam essas Views Base.
3. A API REN-BI lê apenas `dbo.vw_renbi_*`.
4. Se o ERP mudar uma tabela no futuro, basta corrigir a View Base correspondente.

## Arquivos

- `database/sqlserver/01_views_renbi_adapter.sql` — cria toda a camada de views.
- `database/sqlserver/02_validar_views_renbi.sql` — valida quantidades e amostras.
- `database/sqlserver/03_usuario_somente_leitura_EXEMPLO.sql` — modelo comentado de segurança.
- `backend/sql_mapping.example.json` — consultas da API já apontando para as views.

## Views Base que precisam ser ligadas ao ERP

| View | Fonte esperada no ERP |
|---|---|
| `vw_renbi_sales` | Cabeçalho de vendas / cupons / NF / pedidos faturados |
| `vw_renbi_sales_items` | Itens das vendas |
| `vw_renbi_products` | Cadastro de produtos |
| `vw_renbi_inventory` | Posição de estoque |
| `vw_renbi_purchases` | Cabeçalho de compras / NF de entrada |
| `vw_renbi_purchase_items` | Itens das compras |
| `vw_renbi_customers` | Cadastro de clientes |
| `vw_renbi_suppliers` | Cadastro de fornecedores |
| `vw_renbi_sellers` | Cadastro de vendedores |
| `vw_renbi_sales_targets` | Metas comerciais |
| `vw_renbi_receivables` | Contas a receber |
| `vw_renbi_payables` | Contas a pagar |
| `vw_renbi_expenses` | Despesas gerenciais |
| `vw_renbi_cost_centers` | Centros de custo |
| `vw_renbi_accounting_entries` | Lançamentos contábeis |
| `vw_renbi_supplier_products` | Histórico produto x fornecedor |
| `vw_renbi_daily_balances` | Foto diária de estoque/receber/pagar/caixa, se existir |

Cada uma é criada inicialmente como uma **view vazia que compila**. Dentro dela existe um bloco comentado com o marcador:

```sql
/* >>> MAPEAMENTO DO ERP - EXEMPLO
   ...
*/
```

É nesse ponto que os nomes reais de tabela e campos devem ser inseridos.

## Views Analíticas prontas

Depois que as Views Base estiverem mapeadas, o SQL passa a calcular automaticamente:

- `vw_renbi_sales_daily`
- `vw_renbi_product_sales`
- `vw_renbi_inventory_analytics`
- `vw_renbi_accounts_receivable`
- `vw_renbi_accounts_payable`
- `vw_renbi_debtors`
- `vw_renbi_seller_performance`
- `vw_renbi_seller_product_sales`
- `vw_renbi_supplier_performance`
- `vw_renbi_supplier_price_comparison`
- `vw_renbi_purchase_suggestions`
- `vw_renbi_expenses_analytics`
- `vw_renbi_management_daily`
- `vw_renbi_summary`

## Exemplo de adaptação

A View Base é entregue assim:

```sql
CREATE OR ALTER VIEW dbo.vw_renbi_products AS
SELECT
  CAST(NULL AS nvarchar(60)) AS product_id,
  CAST(NULL AS nvarchar(200)) AS product,
  ...
WHERE 1=0;
```

Se o ERP possuir:

- tabela `PRODUTO`
- campo `CODPROD`
- campo `NOMEPROD`
- campo `CUSTO_MEDIO`
- campo `PRECO`

ela deve virar algo como:

```sql
CREATE OR ALTER VIEW dbo.vw_renbi_products AS
SELECT
  CAST(P.CODPROD AS nvarchar(60)) AS product_id,
  CAST(P.NOMEPROD AS nvarchar(200)) AS product,
  CAST(P.GRUPO AS nvarchar(120)) AS category,
  CAST(P.MARCA AS nvarchar(120)) AS brand,
  CAST(P.UNIDADE AS nvarchar(20)) AS unit,
  CAST(P.CUSTO_MEDIO AS decimal(18,4)) AS current_cost,
  CAST(P.PRECO AS decimal(18,4)) AS sale_price,
  CAST(CASE WHEN P.ATIVO='S' THEN 1 ELSE 0 END AS bit) AS active
FROM dbo.PRODUTO P;
```

Nenhuma alteração será necessária no front-end ou nos endpoints da API.

## Ordem recomendada de mapeamento

Para colocar a aplicação em produção mais rapidamente:

1. Produtos
2. Vendas + Itens de Venda
3. Estoque
4. Contas a Receber
5. Contas a Pagar
6. Despesas
7. Clientes e Fornecedores
8. Vendedores e Metas
9. Compras + Itens de Compra
10. Produto x Fornecedor
11. Contabilidade
12. Saldos diários

Com os seis primeiros grupos já é possível alimentar boa parte do Dashboard, Vendas, Estoque, Financeiro, Devedores e Projeções.

## Ativando no backend

Após mapear as views:

1. Copie `backend/sql_mapping.example.json` para `backend/sql_mapping.json`.
2. Troque `"enabled": false` por `"enabled": true` apenas nas entidades já validadas.
3. Configure as variáveis SQL no servidor da API, nunca no GitHub Pages.
4. Use a tela **Integrações / SQL** para testar conexão e visualizar amostras.

## Segurança

A aplicação web hospedada no GitHub Pages **não deve** receber servidor, login ou senha SQL.

Fluxo correto:

```text
GitHub Pages
      ↓ HTTPS/JSON
API REN-BI
      ↓ ODBC / usuário somente leitura
SQL Server
      ↓
dbo.vw_renbi_*
```

Recomenda-se conceder ao usuário REN-BI somente `SELECT` nas Views Analíticas necessárias.
