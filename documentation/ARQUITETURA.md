# Arquitetura de Referência — RenBI 360

## Objetivo

Permitir que qualquer ERP Delphi forneça dados a uma plataforma web gerencial sem exigir que o front-end conheça tabelas, procedures ou particularidades internas do sistema legado.

## Camadas

### 1. ERP / origem
Responsável pela transação operacional: vendas, compras, contas, estoque e cadastros. Continua sendo a fonte primária do fato operacional.

### 2. Adaptador Delphi
Transforma registros internos em entidades canônicas do RenBI 360. Deve manter um controle local de sincronização com `external_id`, data de alteração e status.

### 3. API de integração
- HTTPS obrigatório em produção.
- JSON UTF-8.
- Versionamento por URL (`/api/v1`).
- Autenticação Bearer.
- Idempotência por lote.
- `X-Request-ID` para rastreamento.
- Respostas padronizadas e logs sem dados sensíveis desnecessários.

### 4. Banco gerencial
Separado do banco transacional. Pode receber fatos normalizados e tabelas de dimensão. Para grandes volumes, materializar agregações diárias/mensais.

### 5. Motor de indicadores
Calcula KPIs, rankings, DRE gerencial, metas, previsões e recomendações de compra.

### 6. Web App
Consome somente a API. Pode ser substituído por aplicativo mobile, portal do cliente ou outro BI sem mexer no ERP.

## Multiempresa e filial

Todas as tabelas/fatos devem possuir `company_id`; fatos que dependam de filial também devem possuir `branch_id`. Nunca derive tenant apenas pelo usuário da sessão.

## Sincronização

### Incremental
Registrar no ERP o último `updated_at` ou sequência sincronizada. Enviar lotes de 100 a 2.000 itens conforme tamanho médio do JSON.

### Idempotência
Cada lote deve ter `idempotency_key` única. Repetir o mesmo lote não pode duplicar venda, compra ou lançamento.

### Ordem sugerida
1. cadastros (produto, vendedor, fornecedor, cliente, centro de custo)
2. documentos principais (venda/compra)
3. itens
4. estoque
5. despesas/financeiro
6. lançamentos contábeis

### Reconciliação
Executar, no mínimo diariamente, uma rotina de reconciliação:
- quantidade de documentos;
- total bruto/líquido;
- total de compras;
- saldo de estoque por valor;
- contas a receber/pagar;
- lançamentos contábeis.

## Segurança

- TLS 1.2+ ou política corporativa superior.
- Token curto ou credencial máquina-a-máquina.
- Segregar perfis: integração, gestor, financeiro, comercial, auditor.
- Nunca guardar senha Delphi em código-fonte.
- Rotacionar segredos.
- Logs com `company_id`, endpoint, status e `request_id`.
- Não registrar dados pessoais completos em logs de erro.

## Escalabilidade

Até alguns milhões de itens/mês, PostgreSQL com índices e agregações atende bem a maioria dos cenários. Para cargas superiores, adicionar fila (RabbitMQ/Kafka/SQS), workers assíncronos e camada analítica/OLAP sem alterar o contrato Delphi.

## Previsões

Manter três cenários: conservador, base e otimista. Toda previsão deve registrar:
- data de geração;
- horizonte;
- método;
- variáveis utilizadas;
- valor previsto;
- erro histórico do modelo.

Nunca apresentar previsão como fato consumado.


## v1.4 — Fonte SQL Server

O backend também pode operar como ponte de leitura para Microsoft SQL Server. O navegador continua consumindo somente REST/JSON. Quando `RENBI_DATA_SOURCE=sqlserver`, a API utiliza a fotografia sincronizada pelo `SQLBridge`; a entidade `management_daily` permite agregação por dia, mês e ano. Consulte `INTEGRACAO_SQLSERVER.md`.
