/* ============================================================================
   EXEMPLO DE SEGURANÇA - NÃO EXECUTE SEM REVISAR COM O DBA.
   Objetivo: usuário REN-BI com acesso somente às views vw_renbi_*.

   IMPORTANTE:
   - Defina uma senha forte fora do GitHub.
   - O login pode ser criado pelo DBA conforme a política da empresa.
   - Este exemplo deixa a criação do LOGIN comentada de propósito.
   ============================================================================ */

-- USE [master];
-- CREATE LOGIN [renbi_readonly] WITH PASSWORD = 'COLOQUE_UMA_SENHA_FORTE_FORA_DO_GITHUB';
-- GO

-- USE [SEU_BANCO_ERP]; -- <-- TROCAR PELO BANCO REAL
-- CREATE USER [renbi_readonly] FOR LOGIN [renbi_readonly];
-- GO

-- GRANT SELECT ON OBJECT::dbo.vw_renbi_sales_daily TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_product_sales TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_inventory_analytics TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_accounts_receivable TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_accounts_payable TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_debtors TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_supplier_performance TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_seller_performance TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_expenses_analytics TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_accounting_entries TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_management_daily TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_summary TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_purchase_suggestions TO [renbi_readonly];
-- GRANT SELECT ON OBJECT::dbo.vw_renbi_supplier_price_comparison TO [renbi_readonly];
-- GO
