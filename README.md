# RenBI 360 — v1.4 — GitHub Pages + API Delphi + SQL Server

Este pacote foi preparado para publicação do **front-end do RenBI 360 no GitHub Pages**.

## Estrutura

- `docs/` — site que será publicado pelo GitHub Pages.
- `backend/` — API FastAPI. O GitHub Pages **não executa Python**; hospede esta pasta em um servidor/API separado.
- `delphi/` — unit de referência para integração Delphi REST/JSON.
- `database/` — modelo PostgreSQL de referência.
- `documentation/` — documentação técnica, contrato de dados e OpenAPI.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo: `renbi360`.
2. Envie todo o conteúdo deste pacote para o repositório.
3. No GitHub, abra `Settings` → `Pages`.
4. Em `Build and deployment`, selecione `Deploy from a branch`.
5. Selecione o branch `main` e a pasta `/docs`.
6. Clique em `Save`.
7. Após a publicação, o endereço normalmente será:
   `https://SEU-USUARIO.github.io/renbi360/`

## Modo demonstração

O arquivo `docs/config.js` vem assim:

```js
window.RENBI_API_BASE = "";
```

Com a URL vazia, o painel usa snapshots JSON incluídos em `docs/data/`, permitindo que o GitHub Pages funcione imediatamente, sem backend.

## Ligar na API real

Quando a API estiver hospedada, altere `docs/config.js`:

```js
window.RENBI_API_BASE = "https://api.seudominio.com";
```

Não acrescente `/api/v1` no final. O front-end já acrescenta esse caminho automaticamente.

### CORS

O backend precisa permitir chamadas originadas do domínio do GitHub Pages, por exemplo:

`https://SEU-USUARIO.github.io`

Para produção, substitua `*` por origens explicitamente autorizadas.

## Segurança

**Nunca publique senhas, tokens reais, strings de conexão ou arquivos `.env` no GitHub.**

O arquivo `.gitignore` já bloqueia `.env`, mas confirme antes de cada commit. O modo demonstração contém apenas dados fictícios.

## Importante

O GitHub Pages hospeda somente conteúdo estático (HTML, CSS, JavaScript e arquivos JSON). O backend FastAPI deve ficar em um serviço próprio ou servidor da empresa. O ERP Delphi continua se comunicando com a API por REST/JSON.

## Atualização v1.1 — Segurança, financeiro operacional e exportação

Esta versão acrescenta:
- login e senha;
- controle de usuários e perfis;
- status de licença e bloqueio por inadimplência;
- filtro global por dia, mês ou ano em todos os módulos;
- exportação de tabela individual, módulo atual ou todos os relatórios em Excel/PDF;
- vendas diárias com meta, realizado e diferença;
- contas a pagar e receber em destaque na Visão Geral;
- agenda de contas a pagar/receber;
- acompanhamento de devedores e risco de cobrança;
- novos endpoints e métodos Delphi.

### Credenciais de demonstração no GitHub Pages

- `admin / RenBI@2026`
- `gestor / Gestor@2026`
- `financeiro / Finance@2026`

**Atenção:** o login do GitHub Pages é somente demonstrativo porque todo site estático é público. Para dados reais, configure `window.RENBI_API_BASE` e faça autenticação/licença no backend. Leia `documentation/SEGURANCA_LICENCA_EXPORTACAO.md`.


## Novidade v1.2 — Projeções
Inclui projeções de vendas para semana, mês e ano, consolidação financeira para mês/trimestre/semestre/ano, cenários conservador/realista/otimista, projeção de caixa, ponto de equilíbrio, premissas e insights. Consulte `documentation/PROJECOES_E_CENARIOS.md`.


## Novidade v1.4 — Ponte SQL Server

A aplicação agora está preparada para receber dados reais de Microsoft SQL Server por uma ponte segura no backend. Inclui conexão ODBC, mapeamento configurável, teste de conexão, pré-visualização, sincronização, suporte a filtros Dia/Mês/Ano por base diária e consumo dos dados SQL nos principais módulos.

Leia `documentation/INTEGRACAO_SQLSERVER.md`. **Nunca coloque usuário ou senha do SQL no GitHub Pages.**

## v1.5 — Layout e Views SQL Server

- menu lateral rolável para evitar módulos ocultos em telas menores;
- cabeçalho responsivo;
- camada `dbo.vw_renbi_*` para integração com SQL Server;
- scripts em `database/sqlserver/`;
- documentação em `documentation/MAPEAMENTO_VIEWS_SQLSERVER.md`.
