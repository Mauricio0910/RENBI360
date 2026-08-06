/* ============================================================================
   REN-BI 360 v1.5 - CAMADA DE VIEWS PARA MICROSOFT SQL SERVER
   ----------------------------------------------------------------------------
   OBJETIVO
   Criar uma camada estável entre o banco do ERP e o REN-BI 360.

   COMO USAR
   1) Execute este arquivo no banco SQL Server do ERP.
   2) As VIEWS BASE abaixo são criadas inicialmente como "stubs" vazios e
      COMPILAM mesmo sem conhecermos os nomes reais das suas tabelas.
   3) Em cada VIEW BASE existe um bloco comentado "MAPEAMENTO DO ERP".
      Substitua SOMENTE o SELECT vazio pelo SELECT real da sua tabela.
   4) As VIEWS ANALÍTICAS, mais abaixo, usam apenas as VIEWS BASE. Assim o
      restante do REN-BI não precisa conhecer nomes internos do seu ERP.

   SEGURANÇA
   - Recomenda-se usuário SQL somente leitura (SELECT).
   - Não exponha usuário/senha SQL no GitHub Pages ou JavaScript.
   - A API REN-BI deve ser a única camada que acessa o SQL Server.

   IMPORTANTE
   Os nomes [dbo].[vw_renbi_*] e os aliases das colunas fazem parte do contrato
   de integração. Evite alterá-los. Altere apenas as tabelas/campos marcados.
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ============================================================================
   1. VIEWS BASE / ADAPTADORES
   ============================================================================ */

/* ---------------------------------------------------------------------------
   1.1 VENDAS - CABEÇALHO
   CONECTE AQUI: tabela de vendas/cupon/NF/pedido faturado do ERP.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_sales
AS
    /* STUB SEGURO - substitua este SELECT pelo bloco real abaixo. */
    SELECT
        CAST(NULL AS nvarchar(60))  AS sale_id,
        CAST(NULL AS nvarchar(30))  AS company_id,
        CAST(NULL AS nvarchar(30))  AS branch_id,
        CAST(NULL AS date)          AS sale_date,
        CAST(NULL AS nvarchar(60))  AS customer_id,
        CAST(NULL AS nvarchar(60))  AS seller_id,
        CAST(NULL AS decimal(18,2)) AS gross_total,
        CAST(NULL AS decimal(18,2)) AS discount,
        CAST(NULL AS decimal(18,2)) AS net_total,
        CAST(NULL AS nvarchar(30))  AS status,
        CAST(NULL AS bit)           AS canceled
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO (DESCOMENTE E ADAPTE) ===================
    SELECT
        CAST(V.[ID_VENDA] AS nvarchar(60))               AS sale_id,       -- <-- ID/CHAVE DA VENDA
        CAST(V.[COD_EMPRESA] AS nvarchar(30))            AS company_id,    -- <-- EMPRESA
        CAST(V.[COD_FILIAL] AS nvarchar(30))             AS branch_id,     -- <-- FILIAL/LOJA
        CAST(V.[DATA_VENDA] AS date)                     AS sale_date,     -- <-- DATA DA VENDA
        CAST(V.[COD_CLIENTE] AS nvarchar(60))            AS customer_id,   -- <-- CLIENTE
        CAST(V.[COD_VENDEDOR] AS nvarchar(60))           AS seller_id,     -- <-- VENDEDOR
        CAST(V.[VALOR_BRUTO] AS decimal(18,2))           AS gross_total,   -- <-- TOTAL BRUTO
        CAST(ISNULL(V.[DESCONTO],0) AS decimal(18,2))    AS discount,      -- <-- DESCONTO
        CAST(V.[VALOR_LIQUIDO] AS decimal(18,2))         AS net_total,     -- <-- TOTAL LÍQUIDO
        CAST(V.[STATUS] AS nvarchar(30))                 AS status,        -- <-- STATUS
        CAST(CASE WHEN V.[CANCELADA] = 1 THEN 1 ELSE 0 END AS bit) AS canceled -- <-- CANCELAMENTO
    FROM dbo.[SUA_TABELA_VENDAS] V                       -- <-- TROCAR TABELA
    WHERE V.[DATA_VENDA] IS NOT NULL;
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.2 VENDAS - ITENS
   CONECTE AQUI: itens de venda ligados ao cabeçalho acima.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_sales_items
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS sale_id,
        CAST(NULL AS nvarchar(60))  AS product_id,
        CAST(NULL AS decimal(18,4)) AS quantity,
        CAST(NULL AS decimal(18,4)) AS unit_price,
        CAST(NULL AS decimal(18,2)) AS discount,
        CAST(NULL AS decimal(18,2)) AS net_total,
        CAST(NULL AS decimal(18,4)) AS unit_cost
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(I.[ID_VENDA] AS nvarchar(60))               AS sale_id,       -- <-- FK DA VENDA
        CAST(I.[COD_PRODUTO] AS nvarchar(60))            AS product_id,    -- <-- PRODUTO
        CAST(I.[QUANTIDADE] AS decimal(18,4))            AS quantity,      -- <-- QUANTIDADE
        CAST(I.[VALOR_UNITARIO] AS decimal(18,4))        AS unit_price,    -- <-- PREÇO UNITÁRIO
        CAST(ISNULL(I.[DESCONTO],0) AS decimal(18,2))    AS discount,      -- <-- DESCONTO ITEM
        CAST(I.[VALOR_LIQUIDO] AS decimal(18,2))         AS net_total,     -- <-- TOTAL LÍQUIDO ITEM
        CAST(ISNULL(I.[CUSTO_UNITARIO],0) AS decimal(18,4)) AS unit_cost   -- <-- CUSTO NO MOMENTO DA VENDA
    FROM dbo.[SUA_TABELA_ITENS_VENDA] I                  -- <-- TROCAR TABELA
    WHERE I.[ID_VENDA] IS NOT NULL;
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.3 PRODUTOS
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_products
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS product_id,
        CAST(NULL AS nvarchar(200)) AS product,
        CAST(NULL AS nvarchar(120)) AS category,
        CAST(NULL AS nvarchar(120)) AS brand,
        CAST(NULL AS nvarchar(20))  AS unit,
        CAST(NULL AS decimal(18,4)) AS current_cost,
        CAST(NULL AS decimal(18,4)) AS sale_price,
        CAST(NULL AS bit)           AS active
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(P.[CODIGO] AS nvarchar(60))                 AS product_id,    -- <-- CÓDIGO PRODUTO
        CAST(P.[DESCRICAO] AS nvarchar(200))             AS product,       -- <-- DESCRIÇÃO
        CAST(P.[GRUPO] AS nvarchar(120))                 AS category,      -- <-- GRUPO/CATEGORIA
        CAST(P.[MARCA] AS nvarchar(120))                 AS brand,         -- <-- MARCA
        CAST(P.[UNIDADE] AS nvarchar(20))                AS unit,          -- <-- UNIDADE
        CAST(ISNULL(P.[CUSTO],0) AS decimal(18,4))       AS current_cost,  -- <-- CUSTO ATUAL
        CAST(ISNULL(P.[PRECO_VENDA],0) AS decimal(18,4)) AS sale_price,    -- <-- PREÇO
        CAST(CASE WHEN P.[ATIVO] = 1 THEN 1 ELSE 0 END AS bit) AS active -- <-- ATIVO
    FROM dbo.[SUA_TABELA_PRODUTOS] P;                    -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.4 ESTOQUE
   Uma linha por produto/filial/data de posição.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_inventory
AS
    SELECT
        CAST(NULL AS date)          AS reference_date,
        CAST(NULL AS nvarchar(30))  AS branch_id,
        CAST(NULL AS nvarchar(60))  AS product_id,
        CAST(NULL AS decimal(18,4)) AS stock,
        CAST(NULL AS decimal(18,4)) AS reserved,
        CAST(NULL AS decimal(18,4)) AS available,
        CAST(NULL AS decimal(18,4)) AS avg_cost,
        CAST(NULL AS decimal(18,4)) AS min_stock,
        CAST(NULL AS decimal(18,4)) AS max_stock
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(GETDATE() AS date)                         AS reference_date, -- ou data da posição no ERP
        CAST(E.[COD_FILIAL] AS nvarchar(30))            AS branch_id,      -- <-- FILIAL
        CAST(E.[COD_PRODUTO] AS nvarchar(60))           AS product_id,     -- <-- PRODUTO
        CAST(E.[ESTOQUE] AS decimal(18,4))              AS stock,          -- <-- ESTOQUE FÍSICO
        CAST(ISNULL(E.[RESERVADO],0) AS decimal(18,4))  AS reserved,       -- <-- RESERVADO
        CAST(E.[ESTOQUE]-ISNULL(E.[RESERVADO],0) AS decimal(18,4)) AS available,
        CAST(ISNULL(E.[CUSTO_MEDIO],0) AS decimal(18,4)) AS avg_cost,      -- <-- CUSTO MÉDIO
        CAST(ISNULL(E.[ESTOQUE_MIN],0) AS decimal(18,4)) AS min_stock,     -- <-- ESTOQUE MÍNIMO
        CAST(ISNULL(E.[ESTOQUE_MAX],0) AS decimal(18,4)) AS max_stock      -- <-- ESTOQUE MÁXIMO
    FROM dbo.[SUA_TABELA_ESTOQUE] E;                    -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.5 COMPRAS - CABEÇALHO
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_purchases
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS purchase_id,
        CAST(NULL AS nvarchar(30))  AS company_id,
        CAST(NULL AS nvarchar(30))  AS branch_id,
        CAST(NULL AS date)          AS purchase_date,
        CAST(NULL AS nvarchar(60))  AS supplier_id,
        CAST(NULL AS decimal(18,2)) AS gross_total,
        CAST(NULL AS decimal(18,2)) AS discount,
        CAST(NULL AS decimal(18,2)) AS net_total,
        CAST(NULL AS nvarchar(30))  AS status,
        CAST(NULL AS bit)           AS canceled
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(C.[ID_COMPRA] AS nvarchar(60))              AS purchase_id,   -- <-- CHAVE COMPRA/NF ENTRADA
        CAST(C.[COD_EMPRESA] AS nvarchar(30))            AS company_id,    -- <-- EMPRESA
        CAST(C.[COD_FILIAL] AS nvarchar(30))             AS branch_id,     -- <-- FILIAL
        CAST(C.[DATA_ENTRADA] AS date)                   AS purchase_date, -- <-- DATA ENTRADA/COMPRA
        CAST(C.[COD_FORNECEDOR] AS nvarchar(60))         AS supplier_id,   -- <-- FORNECEDOR
        CAST(C.[VALOR_BRUTO] AS decimal(18,2))           AS gross_total,
        CAST(ISNULL(C.[DESCONTO],0) AS decimal(18,2))    AS discount,
        CAST(C.[VALOR_LIQUIDO] AS decimal(18,2))         AS net_total,
        CAST(C.[STATUS] AS nvarchar(30))                 AS status,
        CAST(CASE WHEN C.[CANCELADA] = 1 THEN 1 ELSE 0 END AS bit) AS canceled
    FROM dbo.[SUA_TABELA_COMPRAS] C;                     -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.6 COMPRAS - ITENS
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_purchase_items
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS purchase_id,
        CAST(NULL AS nvarchar(60))  AS product_id,
        CAST(NULL AS decimal(18,4)) AS quantity,
        CAST(NULL AS decimal(18,4)) AS unit_cost,
        CAST(NULL AS decimal(18,2)) AS net_total
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(I.[ID_COMPRA] AS nvarchar(60))              AS purchase_id,   -- <-- FK COMPRA
        CAST(I.[COD_PRODUTO] AS nvarchar(60))            AS product_id,    -- <-- PRODUTO
        CAST(I.[QUANTIDADE] AS decimal(18,4))            AS quantity,
        CAST(I.[CUSTO_UNITARIO] AS decimal(18,4))        AS unit_cost,
        CAST(I.[VALOR_LIQUIDO] AS decimal(18,2))         AS net_total
    FROM dbo.[SUA_TABELA_ITENS_COMPRA] I;                -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.7 CLIENTES
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_customers
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS customer_id,
        CAST(NULL AS nvarchar(200)) AS customer,
        CAST(NULL AS nvarchar(120)) AS city,
        CAST(NULL AS char(2))       AS state,
        CAST(NULL AS nvarchar(100)) AS segment,
        CAST(NULL AS decimal(18,2)) AS credit_limit,
        CAST(NULL AS bit)           AS active
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(C.[CODIGO] AS nvarchar(60))                 AS customer_id,   -- <-- CLIENTE
        CAST(C.[NOME] AS nvarchar(200))                  AS customer,
        CAST(C.[CIDADE] AS nvarchar(120))                AS city,
        CAST(C.[UF] AS char(2))                          AS state,
        CAST(C.[SEGMENTO] AS nvarchar(100))              AS segment,
        CAST(ISNULL(C.[LIMITE_CREDITO],0) AS decimal(18,2)) AS credit_limit,
        CAST(CASE WHEN C.[ATIVO] = 1 THEN 1 ELSE 0 END AS bit) AS active
    FROM dbo.[SUA_TABELA_CLIENTES] C;                    -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.8 FORNECEDORES
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_suppliers
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS supplier_id,
        CAST(NULL AS nvarchar(200)) AS supplier,
        CAST(NULL AS nvarchar(120)) AS city,
        CAST(NULL AS char(2))       AS state,
        CAST(NULL AS bit)           AS active
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(F.[CODIGO] AS nvarchar(60))                 AS supplier_id,   -- <-- FORNECEDOR
        CAST(F.[NOME] AS nvarchar(200))                  AS supplier,
        CAST(F.[CIDADE] AS nvarchar(120))                AS city,
        CAST(F.[UF] AS char(2))                          AS state,
        CAST(CASE WHEN F.[ATIVO] = 1 THEN 1 ELSE 0 END AS bit) AS active
    FROM dbo.[SUA_TABELA_FORNECEDORES] F;                -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.9 VENDEDORES
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_sellers
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS seller_id,
        CAST(NULL AS nvarchar(200)) AS seller,
        CAST(NULL AS nvarchar(120)) AS team,
        CAST(NULL AS bit)           AS active
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(V.[CODIGO] AS nvarchar(60))                 AS seller_id,     -- <-- VENDEDOR
        CAST(V.[NOME] AS nvarchar(200))                  AS seller,
        CAST(V.[EQUIPE] AS nvarchar(120))                AS team,
        CAST(CASE WHEN V.[ATIVO] = 1 THEN 1 ELSE 0 END AS bit) AS active
    FROM dbo.[SUA_TABELA_VENDEDORES] V;                  -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.10 METAS DE VENDAS
   Pode ser meta individual ou geral. Para meta geral, seller_id pode ser NULL.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_sales_targets
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS seller_id,
        CAST(NULL AS date)          AS period_start,
        CAST(NULL AS date)          AS period_end,
        CAST(NULL AS decimal(18,2)) AS target
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(M.[COD_VENDEDOR] AS nvarchar(60))           AS seller_id,     -- <-- VENDEDOR (ou NULL)
        CAST(M.[DATA_INICIO] AS date)                    AS period_start,  -- <-- INÍCIO META
        CAST(M.[DATA_FIM] AS date)                       AS period_end,    -- <-- FIM META
        CAST(M.[VALOR_META] AS decimal(18,2))            AS target         -- <-- VALOR META
    FROM dbo.[SUA_TABELA_METAS] M;                       -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.11 CONTAS A RECEBER
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_receivables
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS title_id,
        CAST(NULL AS nvarchar(60))  AS customer_id,
        CAST(NULL AS date)          AS issue_date,
        CAST(NULL AS date)          AS due_date,
        CAST(NULL AS date)          AS payment_date,
        CAST(NULL AS nvarchar(200)) AS description,
        CAST(NULL AS decimal(18,2)) AS value,
        CAST(NULL AS decimal(18,2)) AS paid_value,
        CAST(NULL AS nvarchar(30))  AS status
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(R.[ID_TITULO] AS nvarchar(60))              AS title_id,      -- <-- TÍTULO
        CAST(R.[COD_CLIENTE] AS nvarchar(60))            AS customer_id,   -- <-- CLIENTE
        CAST(R.[EMISSAO] AS date)                        AS issue_date,
        CAST(R.[VENCIMENTO] AS date)                     AS due_date,
        CAST(R.[DATA_PAGAMENTO] AS date)                 AS payment_date,
        CAST(R.[DOCUMENTO] AS nvarchar(200))             AS description,
        CAST(R.[VALOR] AS decimal(18,2))                 AS value,
        CAST(ISNULL(R.[VALOR_PAGO],0) AS decimal(18,2))  AS paid_value,
        CAST(R.[STATUS] AS nvarchar(30))                 AS status
    FROM dbo.[SUA_TABELA_CONTAS_RECEBER] R;              -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.12 CONTAS A PAGAR
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_payables
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS title_id,
        CAST(NULL AS nvarchar(60))  AS supplier_id,
        CAST(NULL AS date)          AS issue_date,
        CAST(NULL AS date)          AS due_date,
        CAST(NULL AS date)          AS payment_date,
        CAST(NULL AS nvarchar(200)) AS description,
        CAST(NULL AS decimal(18,2)) AS value,
        CAST(NULL AS decimal(18,2)) AS paid_value,
        CAST(NULL AS nvarchar(30))  AS status,
        CAST(NULL AS nvarchar(60))  AS cost_center_id,
        CAST(NULL AS nvarchar(100)) AS category
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(P.[ID_TITULO] AS nvarchar(60))              AS title_id,      -- <-- TÍTULO
        CAST(P.[COD_FORNECEDOR] AS nvarchar(60))         AS supplier_id,   -- <-- FORNECEDOR
        CAST(P.[EMISSAO] AS date)                        AS issue_date,
        CAST(P.[VENCIMENTO] AS date)                     AS due_date,
        CAST(P.[DATA_PAGAMENTO] AS date)                 AS payment_date,
        CAST(P.[DOCUMENTO] AS nvarchar(200))             AS description,
        CAST(P.[VALOR] AS decimal(18,2))                 AS value,
        CAST(ISNULL(P.[VALOR_PAGO],0) AS decimal(18,2))  AS paid_value,
        CAST(P.[STATUS] AS nvarchar(30))                 AS status,
        CAST(P.[COD_CENTRO_CUSTO] AS nvarchar(60))       AS cost_center_id,-- <-- CENTRO CUSTO
        CAST(P.[CATEGORIA] AS nvarchar(100))             AS category
    FROM dbo.[SUA_TABELA_CONTAS_PAGAR] P;                -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.13 DESPESAS GERENCIAIS
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_expenses
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS expense_id,
        CAST(NULL AS date)          AS expense_date,
        CAST(NULL AS nvarchar(60))  AS cost_center_id,
        CAST(NULL AS nvarchar(120)) AS category,
        CAST(NULL AS nvarchar(250)) AS description,
        CAST(NULL AS decimal(18,2)) AS value,
        CAST(NULL AS nvarchar(20))  AS fixed_variable
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(D.[ID_LANCAMENTO] AS nvarchar(60))          AS expense_id,    -- <-- ID DESPESA
        CAST(D.[DATA_LANCAMENTO] AS date)                AS expense_date,
        CAST(D.[COD_CENTRO_CUSTO] AS nvarchar(60))       AS cost_center_id,
        CAST(D.[CATEGORIA] AS nvarchar(120))             AS category,
        CAST(D.[HISTORICO] AS nvarchar(250))             AS description,
        CAST(D.[VALOR] AS decimal(18,2))                 AS value,
        CAST(D.[TIPO] AS nvarchar(20))                   AS fixed_variable -- FIXA/VARIAVEL
    FROM dbo.[SUA_TABELA_DESPESAS] D;                    -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.14 CENTROS DE CUSTO
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_cost_centers
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS cost_center_id,
        CAST(NULL AS nvarchar(200)) AS cost_center,
        CAST(NULL AS nvarchar(60))  AS parent_id,
        CAST(NULL AS bit)           AS active
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(CC.[CODIGO] AS nvarchar(60))                AS cost_center_id,
        CAST(CC.[DESCRICAO] AS nvarchar(200))            AS cost_center,
        CAST(CC.[COD_PAI] AS nvarchar(60))               AS parent_id,
        CAST(CASE WHEN CC.[ATIVO]=1 THEN 1 ELSE 0 END AS bit) AS active
    FROM dbo.[SUA_TABELA_CENTRO_CUSTO] CC;               -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.15 LANÇAMENTOS CONTÁBEIS
   Campo statement_group deve, se possível, normalizar em grupos como:
   RECEITA, DEDUCAO, CMV, DESPESA_OPERACIONAL, ATIVO, PASSIVO, PL etc.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_accounting_entries
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS entry_id,
        CAST(NULL AS date)          AS entry_date,
        CAST(NULL AS nvarchar(60))  AS account_code,
        CAST(NULL AS nvarchar(200)) AS account_name,
        CAST(NULL AS nvarchar(80))  AS statement_group,
        CAST(NULL AS nvarchar(250)) AS description,
        CAST(NULL AS decimal(18,2)) AS debit,
        CAST(NULL AS decimal(18,2)) AS credit,
        CAST(NULL AS nvarchar(60))  AS cost_center_id
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(L.[ID_LANCAMENTO] AS nvarchar(60))          AS entry_id,
        CAST(L.[DATA_LANCAMENTO] AS date)                AS entry_date,
        CAST(L.[COD_CONTA] AS nvarchar(60))              AS account_code,
        CAST(PC.[DESCRICAO] AS nvarchar(200))            AS account_name,
        CAST(PC.[GRUPO_RENBI] AS nvarchar(80))           AS statement_group, -- <-- MAPEAR GRUPO DRE/BALANÇO
        CAST(L.[HISTORICO] AS nvarchar(250))             AS description,
        CAST(ISNULL(L.[DEBITO],0) AS decimal(18,2))      AS debit,
        CAST(ISNULL(L.[CREDITO],0) AS decimal(18,2))     AS credit,
        CAST(L.[COD_CENTRO_CUSTO] AS nvarchar(60))       AS cost_center_id
    FROM dbo.[SUA_TABELA_LANCAMENTOS_CONTABEIS] L        -- <-- TROCAR TABELA
    LEFT JOIN dbo.[SUA_TABELA_PLANO_CONTAS] PC           -- <-- TROCAR TABELA
      ON PC.[COD_CONTA] = L.[COD_CONTA];
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.16 HISTÓRICO PRODUTO x FORNECEDOR
   Alimenta comparação de preços e qualificação de fornecedores.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_supplier_products
AS
    SELECT
        CAST(NULL AS nvarchar(60))  AS supplier_id,
        CAST(NULL AS nvarchar(60))  AS product_id,
        CAST(NULL AS date)          AS last_purchase_date,
        CAST(NULL AS decimal(18,4)) AS last_cost,
        CAST(NULL AS int)           AS payment_term_days,
        CAST(NULL AS int)           AS delivery_days,
        CAST(NULL AS decimal(9,2))  AS quality_score
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(H.[COD_FORNECEDOR] AS nvarchar(60))         AS supplier_id,
        CAST(H.[COD_PRODUTO] AS nvarchar(60))            AS product_id,
        CAST(H.[ULTIMA_COMPRA] AS date)                  AS last_purchase_date,
        CAST(H.[ULTIMO_CUSTO] AS decimal(18,4))          AS last_cost,
        CAST(ISNULL(H.[PRAZO_PAGAMENTO],0) AS int)       AS payment_term_days,
        CAST(ISNULL(H.[PRAZO_ENTREGA],0) AS int)         AS delivery_days,
        CAST(ISNULL(H.[NOTA_QUALIDADE],0) AS decimal(9,2)) AS quality_score
    FROM dbo.[SUA_TABELA_PRODUTO_FORNECEDOR] H;          -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ---------------------------------------------------------------------------
   1.17 SALDOS DIÁRIOS
   Ideal para histórico de estoque, contas a pagar/receber e caixa.
   Se o ERP não possui snapshots diários, esta VIEW pode começar vazia e ser
   implementada numa segunda etapa. Os fluxos de vendas/compras/despesas ainda
   funcionarão normalmente.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_renbi_daily_balances
AS
    SELECT
        CAST(NULL AS date)          AS reference_date,
        CAST(NULL AS decimal(18,2)) AS inventory,
        CAST(NULL AS decimal(18,2)) AS receivables,
        CAST(NULL AS decimal(18,2)) AS payables,
        CAST(NULL AS decimal(18,2)) AS cash
    WHERE 1 = 0;

    /* >>> MAPEAMENTO DO ERP - EXEMPLO ========================================
    SELECT
        CAST(S.[DATA_REF] AS date)                      AS reference_date, -- <-- DATA DA FOTO/SALDO
        CAST(S.[VALOR_ESTOQUE] AS decimal(18,2))        AS inventory,      -- <-- ESTOQUE A CUSTO
        CAST(S.[SALDO_RECEBER] AS decimal(18,2))        AS receivables,    -- <-- SALDO A RECEBER
        CAST(S.[SALDO_PAGAR] AS decimal(18,2))          AS payables,       -- <-- SALDO A PAGAR
        CAST(S.[SALDO_CAIXA] AS decimal(18,2))          AS cash            -- <-- CAIXA/BANCOS
    FROM dbo.[SUA_TABELA_SALDOS_DIARIOS] S;             -- <-- TROCAR TABELA
    ======================================================================== */
GO

/* ============================================================================
   2. VIEWS ANALÍTICAS - NÃO PRECISAM CONHECER AS TABELAS DO ERP
   ============================================================================ */

/* 2.1 Vendas diárias + meta diária rateada. */
CREATE OR ALTER VIEW dbo.vw_renbi_sales_daily
AS
WITH S AS (
    SELECT
        V.sale_date,
        SUM(V.net_total) AS sales,
        COUNT_BIG(*) AS orders,
        AVG(NULLIF(V.net_total,0)) AS avg_ticket
    FROM dbo.vw_renbi_sales V
    WHERE ISNULL(V.canceled,0)=0
    GROUP BY V.sale_date
)
SELECT
    S.sale_date AS [date],
    CAST(S.sales AS decimal(18,2)) AS sales,
    CAST(ISNULL(T.target,0) AS decimal(18,2)) AS target,
    CAST(S.orders AS bigint) AS orders,
    CAST(ISNULL(S.avg_ticket,0) AS decimal(18,2)) AS avg_ticket
FROM S
OUTER APPLY (
    SELECT SUM(M.target / NULLIF(DATEDIFF(day,M.period_start,M.period_end)+1,0)) AS target
    FROM dbo.vw_renbi_sales_targets M
    WHERE S.sale_date BETWEEN M.period_start AND M.period_end
) T;
GO

/* 2.2 Produtos: quantidade, faturamento, custo e estoque atual. */
CREATE OR ALTER VIEW dbo.vw_renbi_product_sales
AS
WITH SALE AS (
    SELECT
        I.product_id,
        SUM(I.quantity) AS quantity,
        SUM(I.net_total) AS revenue,
        SUM(I.quantity * I.unit_cost) AS cost
    FROM dbo.vw_renbi_sales_items I
    INNER JOIN dbo.vw_renbi_sales V ON V.sale_id=I.sale_id
    WHERE ISNULL(V.canceled,0)=0
    GROUP BY I.product_id
), INV AS (
    SELECT E.product_id, SUM(E.available) AS stock
    FROM dbo.vw_renbi_inventory E
    WHERE E.reference_date=(SELECT MAX(E2.reference_date) FROM dbo.vw_renbi_inventory E2)
    GROUP BY E.product_id
)
SELECT
    P.product_id,
    P.product,
    CAST(ISNULL(S.quantity,0) AS decimal(18,4)) AS quantity,
    CAST(ISNULL(S.revenue,0) AS decimal(18,2)) AS revenue,
    CAST(ISNULL(S.cost,0) AS decimal(18,2)) AS cost,
    CAST(ISNULL(I.stock,0) AS decimal(18,4)) AS stock
FROM dbo.vw_renbi_products P
LEFT JOIN SALE S ON S.product_id=P.product_id
LEFT JOIN INV I ON I.product_id=P.product_id;
GO

/* 2.3 Estoque analítico + consumo médio diário. */
CREATE OR ALTER VIEW dbo.vw_renbi_inventory_analytics
AS
WITH LAST_INV AS (
    SELECT E.*
    FROM dbo.vw_renbi_inventory E
    WHERE E.reference_date=(SELECT MAX(E2.reference_date) FROM dbo.vw_renbi_inventory E2)
), SALES30 AS (
    SELECT
        I.product_id,
        SUM(I.quantity)/30.0 AS avg_daily_sales
    FROM dbo.vw_renbi_sales_items I
    INNER JOIN dbo.vw_renbi_sales V ON V.sale_id=I.sale_id
    WHERE ISNULL(V.canceled,0)=0
      AND V.sale_date >= DATEADD(day,-29,CAST(GETDATE() AS date))
    GROUP BY I.product_id
)
SELECT
    E.product_id,
    P.product,
    CAST(SUM(E.available) AS decimal(18,4)) AS stock,
    CAST(SUM(E.available * E.avg_cost) AS decimal(18,2)) AS cost_value,
    CAST(ISNULL(MAX(S.avg_daily_sales),0) AS decimal(18,4)) AS avg_daily_sales,
    CAST(SUM(E.min_stock) AS decimal(18,4)) AS min_stock,
    CAST(SUM(E.max_stock) AS decimal(18,4)) AS max_stock
FROM LAST_INV E
LEFT JOIN dbo.vw_renbi_products P ON P.product_id=E.product_id
LEFT JOIN SALES30 S ON S.product_id=E.product_id
GROUP BY E.product_id,P.product;
GO

/* 2.4 Contas a receber no formato da API. */
CREATE OR ALTER VIEW dbo.vw_renbi_accounts_receivable
AS
SELECT
    R.due_date,
    C.customer AS counterparty,
    R.description,
    R.value,
    R.paid_value,
    R.status,
    R.title_id,
    R.customer_id,
    R.payment_date
FROM dbo.vw_renbi_receivables R
LEFT JOIN dbo.vw_renbi_customers C ON C.customer_id=R.customer_id;
GO

/* 2.5 Contas a pagar no formato da API. */
CREATE OR ALTER VIEW dbo.vw_renbi_accounts_payable
AS
SELECT
    P.due_date,
    F.supplier AS counterparty,
    P.description,
    P.value,
    P.paid_value,
    P.status,
    P.title_id,
    P.supplier_id,
    P.payment_date,
    P.cost_center_id,
    P.category
FROM dbo.vw_renbi_payables P
LEFT JOIN dbo.vw_renbi_suppliers F ON F.supplier_id=P.supplier_id;
GO

/* 2.6 Devedores / aging resumido. */
CREATE OR ALTER VIEW dbo.vw_renbi_debtors
AS
SELECT
    R.customer_id,
    COALESCE(C.customer,R.customer_id) AS customer,
    CAST(SUM(CASE WHEN R.due_date < CAST(GETDATE() AS date)
                       THEN CASE WHEN R.value-R.paid_value>0 THEN R.value-R.paid_value ELSE 0 END
                  ELSE 0 END) AS decimal(18,2)) AS overdue_value,
    SUM(CASE WHEN R.due_date < CAST(GETDATE() AS date) AND R.value>R.paid_value THEN 1 ELSE 0 END) AS overdue_titles,
    MAX(CASE WHEN R.due_date < CAST(GETDATE() AS date) AND R.value>R.paid_value
             THEN DATEDIFF(day,R.due_date,CAST(GETDATE() AS date)) ELSE 0 END) AS max_days_overdue
FROM dbo.vw_renbi_receivables R
LEFT JOIN dbo.vw_renbi_customers C ON C.customer_id=R.customer_id
GROUP BY R.customer_id,C.customer;
GO

/* 2.7 Vendedores: meta x realizado. */
CREATE OR ALTER VIEW dbo.vw_renbi_seller_performance
AS
WITH ACTUAL AS (
    SELECT seller_id,SUM(net_total) AS actual
    FROM dbo.vw_renbi_sales
    WHERE ISNULL(canceled,0)=0
    GROUP BY seller_id
), TARGETS AS (
    SELECT seller_id,SUM(target) AS target
    FROM dbo.vw_renbi_sales_targets
    GROUP BY seller_id
)
SELECT
    V.seller_id,
    V.seller AS name,
    CAST(ISNULL(T.target,0) AS decimal(18,2)) AS target,
    CAST(ISNULL(A.actual,0) AS decimal(18,2)) AS actual,
    V.team
FROM dbo.vw_renbi_sellers V
LEFT JOIN ACTUAL A ON A.seller_id=V.seller_id
LEFT JOIN TARGETS T ON T.seller_id=V.seller_id;
GO

/* 2.8 Produto por vendedor - mais/menos vendidos por vendedor. */
CREATE OR ALTER VIEW dbo.vw_renbi_seller_product_sales
AS
SELECT
    V.seller_id,
    COALESCE(S.seller,V.seller_id) AS seller,
    I.product_id,
    COALESCE(P.product,I.product_id) AS product,
    CAST(SUM(I.quantity) AS decimal(18,4)) AS quantity,
    CAST(SUM(I.net_total) AS decimal(18,2)) AS revenue,
    CAST(SUM(I.quantity*I.unit_cost) AS decimal(18,2)) AS cost,
    CAST(SUM(I.net_total-(I.quantity*I.unit_cost)) AS decimal(18,2)) AS gross_margin
FROM dbo.vw_renbi_sales V
INNER JOIN dbo.vw_renbi_sales_items I ON I.sale_id=V.sale_id
LEFT JOIN dbo.vw_renbi_sellers S ON S.seller_id=V.seller_id
LEFT JOIN dbo.vw_renbi_products P ON P.product_id=I.product_id
WHERE ISNULL(V.canceled,0)=0
GROUP BY V.seller_id,S.seller,I.product_id,P.product;
GO

/* 2.9 Fornecedores: gasto, preço, prazo e qualidade. */
CREATE OR ALTER VIEW dbo.vw_renbi_supplier_performance
AS
WITH SPEND AS (
    SELECT supplier_id,SUM(net_total) AS spend
    FROM dbo.vw_renbi_purchases
    WHERE ISNULL(canceled,0)=0
    GROUP BY supplier_id
), SCORE AS (
    SELECT supplier_id,
           AVG(CASE WHEN last_cost>0 THEN last_cost END) AS avg_cost,
           AVG(CAST(delivery_days AS decimal(18,2))) AS delivery_days,
           AVG(quality_score) AS quality,
           AVG(CAST(payment_term_days AS decimal(18,2))) AS terms
    FROM dbo.vw_renbi_supplier_products
    GROUP BY supplier_id
), GLOBAL_COST AS (
    SELECT AVG(CASE WHEN last_cost>0 THEN last_cost END) AS avg_cost
    FROM dbo.vw_renbi_supplier_products
)
SELECT
    F.supplier_id,
    F.supplier AS name,
    CAST(ISNULL(SP.spend,0) AS decimal(18,2)) AS spend,
    CAST(CASE WHEN SC.avg_cost IS NULL OR GC.avg_cost IS NULL OR SC.avg_cost=0 THEN 0
              ELSE (GC.avg_cost/SC.avg_cost)*100 END AS decimal(9,2)) AS price_index,
    CAST(CASE WHEN SC.delivery_days IS NULL THEN 0
              WHEN SC.delivery_days<=2 THEN 100
              WHEN SC.delivery_days>=30 THEN 0
              ELSE 100-((SC.delivery_days-2)*100.0/28) END AS decimal(9,2)) AS delivery,
    CAST(ISNULL(SC.quality,0) AS decimal(9,2)) AS quality,
    CAST(CASE WHEN SC.terms IS NULL THEN 0 WHEN SC.terms>=60 THEN 100 ELSE SC.terms*100.0/60 END AS decimal(9,2)) AS terms
FROM dbo.vw_renbi_suppliers F
LEFT JOIN SPEND SP ON SP.supplier_id=F.supplier_id
LEFT JOIN SCORE SC ON SC.supplier_id=F.supplier_id
CROSS JOIN GLOBAL_COST GC;
GO

/* 2.10 Comparação de preço por produto/fornecedor. */
CREATE OR ALTER VIEW dbo.vw_renbi_supplier_price_comparison
AS
SELECT
    H.product_id,
    P.product,
    H.supplier_id,
    F.supplier,
    H.last_purchase_date,
    H.last_cost,
    MIN(H.last_cost) OVER(PARTITION BY H.product_id) AS best_cost,
    DENSE_RANK() OVER(PARTITION BY H.product_id ORDER BY H.last_cost ASC) AS price_rank,
    H.payment_term_days,
    H.delivery_days,
    H.quality_score
FROM dbo.vw_renbi_supplier_products H
LEFT JOIN dbo.vw_renbi_products P ON P.product_id=H.product_id
LEFT JOIN dbo.vw_renbi_suppliers F ON F.supplier_id=H.supplier_id
WHERE H.last_cost IS NOT NULL AND H.last_cost>0;
GO

/* 2.11 Sugestão de compra / não compra. */
CREATE OR ALTER VIEW dbo.vw_renbi_purchase_suggestions
AS
SELECT
    I.product_id,
    I.product,
    I.stock,
    I.avg_daily_sales,
    I.min_stock,
    I.max_stock,
    CAST(CASE WHEN I.avg_daily_sales>0 THEN I.stock/I.avg_daily_sales ELSE NULL END AS decimal(18,2)) AS days_cover,
    CAST(CASE
        WHEN I.stock <= I.min_stock THEN CASE WHEN I.max_stock-I.stock>0 THEN I.max_stock-I.stock ELSE 0 END
        WHEN I.avg_daily_sales>0 AND I.stock/I.avg_daily_sales < 7 THEN CASE WHEN I.max_stock-I.stock>0 THEN I.max_stock-I.stock ELSE 0 END
        ELSE 0 END AS decimal(18,4)) AS suggested_quantity,
    CAST(CASE
        WHEN I.stock <= I.min_stock THEN 'COMPRAR'
        WHEN I.avg_daily_sales>0 AND I.stock/I.avg_daily_sales < 7 THEN 'COMPRAR'
        WHEN I.avg_daily_sales=0 AND I.stock>0 THEN 'NAO_COMPRAR'
        WHEN I.max_stock>0 AND I.stock>=I.max_stock THEN 'NAO_COMPRAR'
        ELSE 'MONITORAR' END AS nvarchar(20)) AS recommendation
FROM dbo.vw_renbi_inventory_analytics I;
GO

/* 2.12 Despesas com centro de custo. */
CREATE OR ALTER VIEW dbo.vw_renbi_expenses_analytics
AS
SELECT
    E.expense_date AS [date],
    COALESCE(C.cost_center,E.cost_center_id) AS cost_center,
    E.category,
    E.description,
    E.value,
    E.fixed_variable,
    E.expense_id,
    E.cost_center_id
FROM dbo.vw_renbi_expenses E
LEFT JOIN dbo.vw_renbi_cost_centers C ON C.cost_center_id=E.cost_center_id;
GO

/* 2.13 Indicadores gerenciais diários.
   Fluxos: vendas, compras, lucro bruto, despesas, lucro líquido.
   Saldos: estoque, receber, pagar e caixa vindos de vw_renbi_daily_balances. */
CREATE OR ALTER VIEW dbo.vw_renbi_management_daily
AS
WITH DATES AS (
    SELECT sale_date AS d FROM dbo.vw_renbi_sales WHERE sale_date IS NOT NULL
    UNION
    SELECT purchase_date FROM dbo.vw_renbi_purchases WHERE purchase_date IS NOT NULL
    UNION
    SELECT expense_date FROM dbo.vw_renbi_expenses WHERE expense_date IS NOT NULL
    UNION
    SELECT reference_date FROM dbo.vw_renbi_daily_balances WHERE reference_date IS NOT NULL
), SALES AS (
    SELECT V.sale_date AS d,
           SUM(V.net_total) AS sales,
           SUM(V.net_total) AS revenue,
           SUM(ISNULL(C.cost,0)) AS cost
    FROM dbo.vw_renbi_sales V
    OUTER APPLY (
        SELECT SUM(I.quantity*I.unit_cost) AS cost
        FROM dbo.vw_renbi_sales_items I
        WHERE I.sale_id=V.sale_id
    ) C
    WHERE ISNULL(V.canceled,0)=0
    GROUP BY V.sale_date
), PURCHASES AS (
    SELECT purchase_date AS d,SUM(net_total) AS purchases
    FROM dbo.vw_renbi_purchases
    WHERE ISNULL(canceled,0)=0
    GROUP BY purchase_date
), EXPENSES AS (
    SELECT expense_date AS d,SUM(value) AS expenses
    FROM dbo.vw_renbi_expenses
    GROUP BY expense_date
)
SELECT
    D.d AS [date],
    CAST(ISNULL(S.revenue,0) AS decimal(18,2)) AS revenue,
    CAST(ISNULL(S.sales,0) AS decimal(18,2)) AS sales,
    CAST(ISNULL(P.purchases,0) AS decimal(18,2)) AS purchases,
    CAST(ISNULL(S.revenue,0)-ISNULL(S.cost,0) AS decimal(18,2)) AS gross_profit,
    CAST(ISNULL(E.expenses,0) AS decimal(18,2)) AS expenses,
    CAST(ISNULL(S.revenue,0)-ISNULL(S.cost,0)-ISNULL(E.expenses,0) AS decimal(18,2)) AS net_profit,
    CAST(ISNULL(B.inventory,0) AS decimal(18,2)) AS inventory,
    CAST(ISNULL(B.receivables,0) AS decimal(18,2)) AS receivables,
    CAST(ISNULL(B.payables,0) AS decimal(18,2)) AS payables,
    CAST(ISNULL(B.cash,0) AS decimal(18,2)) AS cash
FROM DATES D
LEFT JOIN SALES S ON S.d=D.d
LEFT JOIN PURCHASES P ON P.d=D.d
LEFT JOIN EXPENSES E ON E.d=D.d
LEFT JOIN dbo.vw_renbi_daily_balances B ON B.reference_date=D.d;
GO

/* 2.14 Resumo executivo móvel dos últimos 30 dias disponíveis. */
CREATE OR ALTER VIEW dbo.vw_renbi_summary
AS
WITH X AS (
    SELECT MAX([date]) AS max_date FROM dbo.vw_renbi_management_daily
), FLOW AS (
    SELECT
        SUM(M.revenue) AS revenue,
        SUM(M.sales) AS sales,
        SUM(M.purchases) AS purchases,
        SUM(M.gross_profit) AS gross_profit,
        SUM(M.expenses) AS expenses,
        SUM(M.net_profit) AS net_profit
    FROM dbo.vw_renbi_management_daily M
    CROSS JOIN X
    WHERE M.[date] BETWEEN DATEADD(day,-29,X.max_date) AND X.max_date
), BAL AS (
    SELECT TOP (1) inventory,receivables,payables,cash
    FROM dbo.vw_renbi_management_daily
    ORDER BY [date] DESC
)
SELECT
    CAST(ISNULL(F.revenue,0) AS decimal(18,2)) AS revenue,
    CAST(ISNULL(F.sales,0) AS decimal(18,2)) AS sales,
    CAST(ISNULL(F.purchases,0) AS decimal(18,2)) AS purchases,
    CAST(ISNULL(F.gross_profit,0) AS decimal(18,2)) AS gross_profit,
    CAST(ISNULL(F.expenses,0) AS decimal(18,2)) AS expenses,
    CAST(ISNULL(F.net_profit,0) AS decimal(18,2)) AS net_profit,
    CAST(ISNULL(B.inventory,0) AS decimal(18,2)) AS inventory,
    CAST(ISNULL(B.receivables,0) AS decimal(18,2)) AS receivables,
    CAST(ISNULL(B.payables,0) AS decimal(18,2)) AS payables,
    CAST(ISNULL(B.cash,0) AS decimal(18,2)) AS cash
FROM FLOW F
LEFT JOIN BAL B ON 1=1;
GO

/* ============================================================================
   3. VALIDAÇÃO RÁPIDA
   Depois de mapear as VIEWS BASE, estas consultas devem retornar dados.
   ============================================================================ */
-- SELECT TOP (20) * FROM dbo.vw_renbi_sales ORDER BY sale_date DESC;
-- SELECT TOP (20) * FROM dbo.vw_renbi_sales_daily ORDER BY [date] DESC;
-- SELECT TOP (20) * FROM dbo.vw_renbi_product_sales ORDER BY revenue DESC;
-- SELECT TOP (20) * FROM dbo.vw_renbi_inventory_analytics ORDER BY cost_value DESC;
-- SELECT TOP (20) * FROM dbo.vw_renbi_purchase_suggestions ORDER BY recommendation, days_cover;
-- SELECT TOP (20) * FROM dbo.vw_renbi_accounts_receivable ORDER BY due_date;
-- SELECT TOP (20) * FROM dbo.vw_renbi_debtors ORDER BY overdue_value DESC;
-- SELECT TOP (20) * FROM dbo.vw_renbi_supplier_performance ORDER BY spend DESC;
-- SELECT TOP (20) * FROM dbo.vw_renbi_seller_performance ORDER BY actual DESC;
-- SELECT TOP (20) * FROM dbo.vw_renbi_management_daily ORDER BY [date] DESC;
-- SELECT * FROM dbo.vw_renbi_summary;
GO
