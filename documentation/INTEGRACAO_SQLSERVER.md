# RenBI 360 v1.4 — Integração com Microsoft SQL Server

## Objetivo

A v1.4 deixa o RenBI preparado para consumir dados reais de um ERP em **Microsoft SQL Server** sem expor o banco ao navegador. A integração foi desenhada para coexistir com a integração Delphi REST/JSON já existente.

## Regra arquitetural

**Nunca conecte o GitHub Pages diretamente ao SQL Server.** O fluxo correto é:

```text
SQL Server do ERP
      ↓ ODBC / usuário somente-leitura
Backend RenBI (FastAPI)
      ↓ REST/JSON + HTTPS
GitHub Pages / REN-BI 360
```

Se o SQL Server estiver somente na rede local e não puder ser acessado pela API, use o segundo fluxo:

```text
SQL Server → ERP/serviço Delphi → API RenBI → Painel
```

## O que já está pronto

- ponte `backend/sql_bridge.py`;
- driver Python `pyodbc`;
- `backend/Dockerfile` com Microsoft ODBC Driver 18;
- configuração por variáveis de ambiente;
- mapeamento de tabelas sem recompilar a aplicação;
- consultas exclusivamente `SELECT`/CTE;
- teste de conexão pela interface;
- pré-visualização de até 100 registros por entidade;
- sincronização manual pela interface/API;
- fotografia local dos dados sincronizados;
- uso dos dados SQL pelo Dashboard, Vendas, Estoque, Financeiro e Projeções quando `RENBI_DATA_SOURCE=sqlserver`;
- base diária opcional para filtros **Dia / Mês / Ano**.

## 1. Variáveis de ambiente

No servidor que executará a API RenBI, crie `backend/.env` ou cadastre as variáveis no provedor de hospedagem:

```env
DEMO_MODE=false
RENBI_DATA_SOURCE=sqlserver
SQL_ENABLED=true
SQL_DRIVER=ODBC Driver 18 for SQL Server
SQL_SERVER=10.0.0.15
SQL_PORT=1433
SQL_DATABASE=ERP_PRODUCAO
SQL_USERNAME=renbi_readonly
SQL_PASSWORD=SENHA_FORTE_AQUI
SQL_ENCRYPT=yes
SQL_TRUST_SERVER_CERTIFICATE=no
SQL_CONNECTION_TIMEOUT=8
SQL_QUERY_TIMEOUT=30
SQL_MAX_ROWS_PER_ENTITY=50000
```

**Não faça commit do `.env`.** O `.gitignore` do projeto bloqueia esse arquivo.

## 2. Usuário SQL recomendado

Crie um login específico para o RenBI e conceda somente leitura nas views/tabelas necessárias. Não use `sa`, usuário administrador ou credenciais do ERP.

Exemplo conceitual — ajuste ao ambiente e à política de segurança:

```sql
CREATE LOGIN renbi_readonly WITH PASSWORD = 'senha-forte';
USE ERP_PRODUCAO;
CREATE USER renbi_readonly FOR LOGIN renbi_readonly;
GRANT SELECT ON dbo.VW_RENBI_GERENCIAL TO renbi_readonly;
GRANT SELECT ON dbo.VW_RENBI_ESTOQUE TO renbi_readonly;
GRANT SELECT ON dbo.VW_RENBI_FINANCEIRO TO renbi_readonly;
```

A melhor prática é criar **views específicas para o BI**, reduzindo acoplamento com tabelas internas do ERP.

## 3. Mapeamento

Copie no servidor da API:

```text
backend/sql_mapping.example.json
        ↓
backend/sql_mapping.json
```

Depois adapte as consultas. O arquivo real `sql_mapping.json` está no `.gitignore`.

O RenBI aceita apenas `SELECT` e CTE (`WITH`). Comandos de escrita ou alteração são bloqueados pela ponte SQL.

## 4. Entidades disponíveis

### `management_daily` — recomendada

Uma linha por dia. Permite respeitar os filtros globais Dia, Mês e Ano.

Aliases canônicos:

```text
date
revenue
sales
purchases
gross_profit
expenses
net_profit
inventory
receivables
payables
cash
```

Os campos `revenue`, `sales`, `purchases`, `gross_profit`, `expenses` e `net_profit` são somados no período. `inventory`, `receivables`, `payables` e `cash` são tratados como saldos e o RenBI usa a posição mais recente do período.

### `summary`

Fallback simplificado com uma única linha dos KPIs principais.

### `sales_daily`

```text
date, sales, target, orders, avg_ticket
```

### `products`

```text
product_id, product, quantity, revenue, cost, stock
```

Opcionalmente inclua `seller_id` para ranking por vendedor.

### `inventory`

```text
product_id, product, stock, cost_value, avg_daily_sales, min_stock, max_stock
```

A partir desses campos o RenBI calcula cobertura e sugestões de compra/não compra.

### `accounts_receivable` e `accounts_payable`

```text
due_date, counterparty, description, value, paid_value, status
```

O RenBI identifica títulos vencidos, a vencer e do dia e gera a área de devedores.

### `sellers`

```text
seller_id, name, target, actual
```

### `suppliers`

```text
supplier_id, name, spend, price_index, delivery, quality, terms
```

### `expenses`

```text
date, cost_center, category, description, value, fixed_variable
```

### `accounting_entries`

Base para evoluir DRE/DMPL/Balanço com o plano de contas real:

```text
date, account_code, description, debit, credit
```

## 5. Endpoints adicionados

```text
GET  /api/v1/sql/status
POST /api/v1/sql/test
POST /api/v1/sql/sync
GET  /api/v1/sql/preview/{entity}?limit=20
GET  /api/v1/sql/snapshot/{entity}?limit=100
```

`/sql/test`, `/sql/sync` e `/sql/preview` exigem perfil administrativo.

## 6. Ativação no front-end

O GitHub Pages precisa apontar para a API publicada em `docs/config.js`:

```js
window.RENBI_API_BASE = "https://api.seudominio.com";
```

A URL deve ser a raiz do backend, sem `/api/v1`.

## 7. Sincronização

No menu **Integrações / SQL**:

1. confira servidor e banco;
2. clique em **Testar conexão**;
3. revise as entidades ativas;
4. use **Pré-visualizar 20 linhas**;
5. clique em **Sincronizar agora**.

A sincronização salva uma fotografia no backend. Em produção, configure uma rotina agendada para chamar `/api/v1/sql/sync` em intervalo adequado ou implemente uma fila incremental.

## 8. Segurança de rede

Para SQL Server local, prefira VPN site-to-site, túnel privado ou um sincronizador Delphi local. Não recomendamos publicar a porta 1433 diretamente na Internet.

## 9. Próxima etapa para conectar ao ERP real

A única etapa que depende do seu banco é o **mapeamento dos nomes reais de tabelas e colunas**. Para fazer isso sem tentativa e erro, o desenvolvedor deve fornecer o dicionário de dados ou consultas das tabelas de:

- vendas e itens;
- produtos/estoque;
- compras;
- contas a pagar/receber;
- clientes/fornecedores;
- vendedores/metas;
- despesas/centros de custos;
- lançamentos contábeis.

A partir disso, basta substituir as consultas de exemplo em `sql_mapping.json`.

---

## Atualização v1.5 — integração por Views

A partir da v1.5, a forma recomendada de integração é criar as Views `dbo.vw_renbi_*` no banco do ERP. Isso reduz o acoplamento entre a API e a estrutura interna do SQL Server.

Use:

- `database/sqlserver/01_views_renbi_adapter.sql`
- `database/sqlserver/02_validar_views_renbi.sql`
- `documentation/MAPEAMENTO_VIEWS_SQLSERVER.md`

Os pontos onde os nomes reais das tabelas e campos devem ser inseridos estão marcados no SQL com `MAPEAMENTO DO ERP`.
