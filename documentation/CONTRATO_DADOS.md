# Contrato Canônico de Dados

Este documento define os campos que o adaptador Delphi deve produzir. Os nomes internos do ERP podem ser diferentes.

## Convenções

- IDs externos: `string`, estáveis e únicos por empresa.
- Datas/horas: ISO-8601 com fuso, exemplo `2026-08-03T14:30:00-03:00`.
- Valores monetários: número decimal, nunca texto formatado com `R$`.
- Quantidades: decimal quando produto permitir fracionamento.
- Exclusões: `operation = delete`, preservando trilha de auditoria.

## Entidades

### product
Campos mínimos:
- `product_id`
- `sku`
- `barcode`
- `name`
- `category_id`
- `brand`
- `unit`
- `cost`
- `sale_price`
- `active`

Campos recomendados:
- `min_stock`, `max_stock`, `lead_time_days`, `tax_group`, `ncm`, `supplier_id`

### seller
- `seller_id`
- `name`
- `team_id`
- `manager_id`
- `active`

### supplier
- `supplier_id`
- `name`
- `tax_id`
- `state`
- `city`
- `payment_terms_days`
- `active`

### sale
- `sale_id`
- `document_number`
- `issued_at`
- `customer_id`
- `seller_id`
- `branch_id`
- `channel`
- `gross_total`
- `discount`
- `net_total`
- `cost_total`
- `status`

### sale_item
- `sale_item_id`
- `sale_id`
- `product_id`
- `quantity`
- `unit_price`
- `discount`
- `net_total`
- `unit_cost`

### purchase
- `purchase_id`
- `supplier_id`
- `issued_at`
- `received_at`
- `gross_total`
- `discount`
- `freight`
- `net_total`
- `status`

### purchase_item
- `purchase_item_id`
- `purchase_id`
- `product_id`
- `quantity`
- `unit_cost`
- `net_total`

### inventory
Uma posição por produto/filial/data:
- `snapshot_id`
- `product_id`
- `branch_id`
- `snapshot_at`
- `quantity`
- `avg_cost`
- `reserved_quantity`

### expense
- `expense_id`
- `competence_date`
- `payment_date`
- `cost_center_id`
- `supplier_id` opcional
- `category`
- `nature` = `fixed` ou `variable`
- `amount`
- `status`

### cost_center
- `cost_center_id`
- `code`
- `name`
- `parent_id` opcional
- `active`

### accounting_entry
Necessário para demonstrações contábeis consistentes:
- `entry_id`
- `competence_date`
- `account_code`
- `account_name`
- `cost_center_id`
- `debit`
- `credit`
- `history`
- `source_document_id`

## Envelope de sincronização

```json
{
  "source_system": "delphi-erp",
  "company_id": "EMP001",
  "branch_id": "FIL001",
  "idempotency_key": "2026-08-03T14:00:00Z-001",
  "items": [
    {
      "entity": "sale",
      "external_id": "VENDA-10293",
      "operation": "upsert",
      "occurred_at": "2026-08-03T14:00:00-03:00",
      "data": {
        "seller_id": "V003",
        "gross_total": 1280.50,
        "discount": 30.00,
        "net_total": 1250.50
      }
    }
  ]
}
```

## Regras de qualidade

Rejeitar ou colocar em quarentena:
- venda sem ID;
- item sem produto;
- valor líquido incoerente além da tolerância definida;
- quantidade negativa sem natureza de devolução/ajuste;
- lançamento contábil sem débito/crédito consistente;
- data fora de faixa operacional sem justificativa.
