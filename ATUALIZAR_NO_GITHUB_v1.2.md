# Atualização RenBI 360 v1.2 no GitHub Codespaces

1. Envie `RenBI360_Atualizacao_v1.2.zip` para a raiz do repositório.
2. No Terminal do Codespace execute:

```bash
unzip -o RenBI360_Atualizacao_v1.2.zip
rm RenBI360_Atualizacao_v1.2.zip
git add -A
git commit -m "RenBI 360 v1.2 - modulo de projecoes"
git pull --rebase origin main
git push origin main
```

Se `git pull --rebase` apresentar conflito, interrompa e resolva o conflito antes do push.

O GitHub Pages continua em `main /docs`.
