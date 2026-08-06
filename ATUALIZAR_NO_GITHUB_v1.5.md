# Atualização REN-BI 360 v1.5

Esta versão inclui:

- correção do menu lateral para nenhuma aba ficar escondida;
- rolagem própria no menu em telas de baixa altura;
- cabeçalho responsivo para filtros/exportação;
- camada completa de Views SQL Server;
- pontos de conexão com as tabelas do ERP comentados no script;
- `sql_mapping.example.json` migrado para as Views `dbo.vw_renbi_*`;
- API identificada como v1.5.

## Atualização no Codespace

Depois de enviar `RenBI360_Atualizacao_v1.5_Layout_SQL_Views.zip` para a raiz do repositório:

```bash
git pull --rebase origin main
unzip -o RenBI360_Atualizacao_v1.5_Layout_SQL_Views.zip
rm RenBI360_Atualizacao_v1.5_Layout_SQL_Views.zip
git add -A
git commit -m "RenBI 360 v1.5 - layout e views SQL"
git pull --rebase origin main
git push origin main
```

A configuração do GitHub Pages permanece em `main /docs`.
