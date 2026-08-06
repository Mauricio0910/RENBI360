# Adaptador SQL Server / ERP Delphi — Modelo de Mapeamento

Se o ERP usa Microsoft SQL Server, não é necessário migrar o banco operacional. O adaptador apenas lê alterações e transforma registros para o contrato JSON.

## Estratégia recomendada

1. Não executar consultas analíticas pesadas no banco de produção durante horário de pico.
2. Usar `updated_at`, sequence, rowversion ou uma fila de integração para identificar alterações.
3. Enviar lotes pela API.
4. Persistir o último checkpoint somente após resposta 2xx.

## Exemplo conceitual de extração de vendas

```sql
SELECT
    V.ID_VENDA        AS sale_id,
    V.NUM_DOCUMENTO   AS document_number,
    V.DATA_EMISSAO    AS issued_at,
    V.ID_CLIENTE      AS customer_id,
    V.ID_VENDEDOR     AS seller_id,
    V.VALOR_BRUTO     AS gross_total,
    V.DESCONTO        AS discount,
    V.VALOR_LIQUIDO   AS net_total,
    V.CUSTO_TOTAL     AS cost_total,
    V.STATUS          AS status
FROM VENDAS V
WHERE V.DATA_ALTERACAO > @ULTIMO_CHECKPOINT
ORDER BY V.DATA_ALTERACAO, V.ID_VENDA;
```

Os nomes acima são exemplos. O projeto **não pressupõe** que o ERP possua essas tabelas/colunas.

## FireDAC

O desenvolvedor pode usar `TFDQuery` para extração e `System.JSON` para montar o lote. Evite montar JSON por concatenação de strings; use `TJSONObject`/`TJSONArray` para escapar caracteres corretamente.

## Checkpoint

Tabela local sugerida:

```sql
CREATE TABLE BI_SYNC_CHECKPOINT (
    ENTIDADE varchar(50) NOT NULL PRIMARY KEY,
    ULTIMO_VALOR varchar(200) NULL,
    ATUALIZADO_EM datetime2 NOT NULL DEFAULT sysdatetime()
);
```

## Consistência

Quando uma venda tiver cabeçalho e itens, envie ambos no mesmo lote quando possível. Se não for possível, o servidor deve aceitar processamento eventual e marcar relacionamento pendente até o item/pai chegar.
