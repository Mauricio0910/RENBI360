# Atualizar REN-BI para v1.4 — SQL Server

1. Envie `RenBI360_Atualizacao_v1.4_SQL.zip` para a raiz do repositório.
2. Abra o Codespace e execute:

```bash
git pull --rebase origin main
unzip -o RenBI360_Atualizacao_v1.4_SQL.zip
rm RenBI360_Atualizacao_v1.4_SQL.zip
git add -A
git commit -m "RenBI 360 v1.4 - integracao SQL Server"
git pull --rebase origin main
git push origin main
```

O GitHub Pages continuará publicando `/docs`. A ponte SQL roda no backend, não no GitHub Pages.
