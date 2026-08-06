# RenBI 360 — Segurança, licença, filtros e exportação

## 1. Login e controle de usuários

O front-end possui tela de login e controle de perfis. No modo demonstração do GitHub Pages, os usuários ficam no `localStorage` apenas para demonstrar a experiência.

**Isso não é segurança de produção.** Como o GitHub Pages é estático e público, a validação real precisa ocorrer na API.

Perfis previstos:
- `superadmin`: administração SaaS/licença;
- `admin`: usuários e todos os módulos da empresa;
- `manager`: visão gerencial completa;
- `sales`: visão geral, vendas e equipe;
- `finance`: visão geral, financeiro e fornecedores;
- `viewer`: consulta.

A API possui endpoints de login, sessão e usuários. Em produção, substitua o armazenamento em memória por banco de dados, senha com Argon2/bcrypt/PBKDF2, expiração de sessão e trilha de auditoria.

## 2. Bloqueio por falta de pagamento

O bloqueio verdadeiro deve ser executado **no backend**. Nunca confie apenas em esconder a interface com JavaScript.

Fluxo recomendado:
1. sistema de cobrança altera `bi_license.status` para `grace` ou `blocked`;
2. toda requisição de relatórios valida licença;
3. se `blocked`, a API responde HTTP `402` com motivo, vencimento e contato financeiro;
4. o front-end exibe a tela de bloqueio;
5. integração de dados pode continuar sendo recebida, se a política comercial desejar, evitando buraco de sincronização quando o cliente regularizar.

## 3. Filtro global

Todos os módulos recebem:
- `granularity=day|month|year`
- `reference=YYYY-MM-DD|YYYY-MM|YYYY`
- `period=7d|30d|12m` para compatibilidade com a primeira versão da API.

A camada SQL deve filtrar pelos campos de competência/emissão/movimento adequados a cada relatório.

## 4. Exportação

O front-end permite:
- exportar uma tabela individual em Excel ou PDF;
- exportar o módulo atual;
- exportar todos os relatórios acessíveis ao usuário em um único arquivo.

Excel usa SheetJS no navegador. PDF usa jsPDF + AutoTable. Há fallback para XLS/Impressão caso as bibliotecas externas não sejam carregadas.

## 5. Contas a pagar, receber e cobrança

Novos endpoints:
- `GET /api/v1/finance/obligations`
- `GET /api/v1/finance/debtors`
- `GET /api/v1/sales/daily`

Para produção, alimente `bi_financial_title` com títulos do Delphi e `bi_collection_action` com histórico de cobrança.
