/* REN-BI 360 v1.5 - DIAGNÓSTICO DAS VIEWS SQL SERVER
   Execute após adaptar 01_views_renbi_adapter.sql. */
SET NOCOUNT ON;

SELECT 'vw_renbi_sales' AS [view], COUNT_BIG(*) AS rows_count FROM dbo.vw_renbi_sales
UNION ALL SELECT 'vw_renbi_sales_items', COUNT_BIG(*) FROM dbo.vw_renbi_sales_items
UNION ALL SELECT 'vw_renbi_products', COUNT_BIG(*) FROM dbo.vw_renbi_products
UNION ALL SELECT 'vw_renbi_inventory', COUNT_BIG(*) FROM dbo.vw_renbi_inventory
UNION ALL SELECT 'vw_renbi_purchases', COUNT_BIG(*) FROM dbo.vw_renbi_purchases
UNION ALL SELECT 'vw_renbi_purchase_items', COUNT_BIG(*) FROM dbo.vw_renbi_purchase_items
UNION ALL SELECT 'vw_renbi_customers', COUNT_BIG(*) FROM dbo.vw_renbi_customers
UNION ALL SELECT 'vw_renbi_suppliers', COUNT_BIG(*) FROM dbo.vw_renbi_suppliers
UNION ALL SELECT 'vw_renbi_sellers', COUNT_BIG(*) FROM dbo.vw_renbi_sellers
UNION ALL SELECT 'vw_renbi_receivables', COUNT_BIG(*) FROM dbo.vw_renbi_receivables
UNION ALL SELECT 'vw_renbi_payables', COUNT_BIG(*) FROM dbo.vw_renbi_payables
UNION ALL SELECT 'vw_renbi_expenses', COUNT_BIG(*) FROM dbo.vw_renbi_expenses
UNION ALL SELECT 'vw_renbi_accounting_entries', COUNT_BIG(*) FROM dbo.vw_renbi_accounting_entries;

SELECT TOP (20) * FROM dbo.vw_renbi_management_daily ORDER BY [date] DESC;
SELECT * FROM dbo.vw_renbi_summary;
SELECT TOP (20) * FROM dbo.vw_renbi_purchase_suggestions ORDER BY recommendation, days_cover;
SELECT TOP (20) * FROM dbo.vw_renbi_debtors ORDER BY overdue_value DESC;
