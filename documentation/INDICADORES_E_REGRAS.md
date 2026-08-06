# Indicadores e Regras de Negócio

## Comercial

- **Faturamento**: valor fiscal/gerencial conforme parametrização da empresa.
- **Vendas líquidas**: vendas - devoluções - cancelamentos - descontos definidos pela regra.
- **Ticket médio**: vendas líquidas / pedidos válidos.
- **Conversão**: oportunidades ganhas / oportunidades trabalhadas, quando CRM estiver integrado.
- **Atingimento de meta**: realizado / meta.
- **A realizar**: máximo(0, meta - realizado).
- **Forecast comercial**: realizado + pipeline ponderado ou modelo estatístico.

## Produtos

### Mais vendidos
Permitir ranking por:
- quantidade;
- faturamento;
- margem bruta;
- contribuição;
- filial;
- vendedor;
- categoria;
- período.

### Menos vendidos
Evitar considerar produto recém-cadastrado ou sem disponibilidade como "pior" sem contexto. Registrar dias ativos e dias com estoque disponível.

## Estoque

- **Cobertura em dias** = estoque disponível / média diária de saída.
- **Giro** = CMV anual / estoque médio.
- **Estoque parado**: parametrizável por dias sem venda.
- **Ruptura potencial**: cobertura < lead time + estoque de segurança.

### Sugestão de compra

```text
Necessidade = demanda prevista durante horizonte
            + estoque de segurança
            - estoque disponível
            - pedidos de compra já abertos
```

Arredondar por múltiplo de embalagem e respeitar mínimo do fornecedor.

### Sugestão de não compra

Bloquear/recomendar pausa quando:
- cobertura acima do máximo;
- giro abaixo do limite;
- produto com tendência de queda;
- estoque parado alto;
- pedido já aberto suficiente.

## Financeiro

- **Custo mensal**: despesas + custos apropriados por competência.
- **Custo anual**: soma por competência; não multiplicar automaticamente um mês atípico por 12.
- **Fluxo de caixa projetado**: entradas e saídas por data financeira, separado da DRE.
- **Capital de giro**: acompanhar contas a receber, estoque, caixa e contas a pagar em conjunto.

## DRE

Estrutura mínima:
1. Receita Bruta
2. (-) Deduções
3. Receita Líquida
4. (-) CMV/CPV
5. Lucro Bruto
6. (-) Despesas Operacionais
7. EBITDA
8. (-) Depreciação/Amortização
9. EBIT
10. Resultado Financeiro
11. Impostos sobre lucro
12. Lucro Líquido

A forma oficial deve seguir o plano de contas e política contábil adotados pela empresa.

## DMPL

Depende de eventos do patrimônio líquido: capital, reservas, ajustes, lucro/prejuízo, dividendos/distribuições e demais movimentações.

## Fornecedores

Score sugerido e totalmente parametrizável:
- preço: 38%
- entrega: 24%
- qualidade: 24%
- condição comercial: 14%

Adicionar no futuro: ruptura causada, divergência de nota, devolução, SLA, bonificação e concentração de risco.

## Previsão de crescimento/queda

Primeira versão:
- média móvel;
- tendência linear;
- sazonalidade mensal;
- comparação ano contra ano.

Versão avançada:
- modelos por categoria/filial;
- variáveis externas;
- intervalo de confiança;
- backtesting e MAPE/MAE.

## Oportunidades de mercado

Nunca usar apenas população. Score recomendado:
- tamanho do mercado;
- crescimento;
- densidade empresarial do segmento;
- concorrência;
- distância/logística;
- carteira instalada;
- ticket potencial;
- inadimplência regional;
- aderência ao ICP.

Toda informação externa deve guardar `source`, `reference_date` e `collected_at`.

## Financeiro operacional v1.1

Indicadores adicionados:
- contas a pagar total e do dia;
- contas a receber total e do dia;
- contas a pagar vencidas;
- recebíveis vencidos;
- quantidade de clientes devedores;
- dias médios de atraso e risco de cobrança;
- vendas diárias, meta diária, diferença e percentual de atingimento.

A classificação de devedores deve combinar, quando disponível: valor vencido, dias de atraso, quantidade de títulos, reincidência, limite de crédito, histórico de pagamento e contato de cobrança.
