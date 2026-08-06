# Guia de Integração Delphi

## Compatibilidade

A integração foi desenhada para componentes REST do Delphi (`REST.Client`) e JSON (`System.JSON`). O endpoint usa HTTP/HTTPS e JSON, portanto também pode ser consumido com `THTTPClient` ou bibliotecas equivalentes.

## Configuração

Parâmetros sugeridos no ERP:

```text
RENBI_API_URL=https://bi.suaempresa.com
RENBI_API_TOKEN=<segredo>
RENBI_COMPANY_ID=EMP001
RENBI_BRANCH_ID=FIL001
RENBI_SYNC_ENABLED=1
RENBI_BATCH_SIZE=500
```

## Autenticação

Em produção, enviar:

```http
Authorization: Bearer <token>
```

O MVP possui `POST /api/v1/auth/login` apenas para facilitar o protótipo. Para integração máquina-a-máquina, prefira token/OAuth2 configurado fora do código.

## Envio de lote

Endpoint:

```http
POST /api/v1/integration/batches
Content-Type: application/json
Authorization: Bearer <token>
X-Idempotency-Key: <mesma-chave-do-body>
```

### Resposta esperada

```json
{
  "batch_id": "batch-1780000000",
  "status": "accepted",
  "accepted": 500,
  "rejected": 0,
  "idempotency_key": "...",
  "received_at": "..."
}
```

## Estratégia no ERP

Criar uma tabela/fila local, por exemplo `BI_SYNC_QUEUE`:

- `ID`
- `ENTITY`
- `EXTERNAL_ID`
- `OPERATION`
- `UPDATED_AT`
- `STATUS` (`PENDING`, `SENT`, `ERROR`)
- `ATTEMPTS`
- `LAST_ERROR`
- `NEXT_RETRY_AT`

Cada alteração relevante adiciona/atualiza uma linha na fila. Um serviço/timer envia lotes.

## Retentativa

- 2xx: marcar enviado.
- 400/422: erro de contrato; não repetir indefinidamente, exigir correção.
- 401/403: credencial/permissão; interromper lote e alertar.
- 408/429/5xx: repetir com backoff exponencial.

Exemplo de espera: 30s, 1min, 2min, 5min, 15min, 30min.

## Delphi

A unidade `delphi/UManager360Api.pas` contém um wrapper simples. O desenvolvedor deve:

1. colocar a URL base;
2. definir o token;
3. montar `TJSONObject/TJSONArray` com os fatos;
4. chamar `SendBatch`;
5. gravar retorno e status na fila de sincronização.

## Consulta de relatórios pelo próprio Delphi

O mesmo wrapper pode chamar, por exemplo:

```text
GET /api/v1/dashboard/summary?period=30d
GET /api/v1/finance/dre?period=30d
GET /api/v1/sales-team/performance
GET /api/v1/suppliers/ranking
```

Assim, telas do ERP Delphi podem exibir os mesmos números da aplicação web.

## Paginação para produção

Endpoints de listas grandes devem suportar:

```text
?page=1&page_size=100
```

E retornar:

```json
{
  "items": [],
  "page": 1,
  "page_size": 100,
  "total": 15422
}
```

## Datas e competência

Separar sempre:
- emissão;
- competência;
- vencimento;
- pagamento/recebimento;
- sincronização.

Misturar essas datas é uma das principais causas de divergência entre ERP, financeiro e DRE.

## Novidades v1.1

### Filtro global dia/mês/ano

As consultas gerenciais podem enviar:

```text
period=30d&granularity=month&reference=2026-08
```

Exemplos:

```text
GET /api/v1/sales/daily?period=7d&granularity=day&reference=2026-08-04
GET /api/v1/finance/obligations?period=30d&granularity=month&reference=2026-08
GET /api/v1/finance/debtors?period=12m&granularity=year&reference=2026
```

A unit `UManager360Api.pas` já possui métodos para vendas diárias, contas a pagar/receber, devedores e situação da licença.

### Login, usuários e licença

O front-end usa `POST /api/v1/auth/login` e envia o token em `Authorization: Bearer <token>`.

A API deve validar licença em cada consulta. Se a licença estiver bloqueada, recomenda-se retornar HTTP 402 com os dados da pendência. O bloqueio não deve existir somente no JavaScript do GitHub Pages.
