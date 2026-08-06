# Atualizar o RenBI 360 no GitHub Codespaces

1. Envie `RenBI360_Atualizacao_v1.1.zip` para a raiz do repositório `REN-BI`.
2. Abra `Code > Codespaces` e entre no Codespace.
3. No Terminal, execute:

```bash
unzip -o RenBI360_Atualizacao_v1.1.zip
rm RenBI360_Atualizacao_v1.1.zip
git add -A
git commit -m "RenBI 360 v1.1 - usuarios financeiro filtros e exportacao"
git push origin main
```

4. O GitHub Pages continuará usando `main /docs`; não é necessário alterar essa configuração.
5. Após o deploy, faça Ctrl+F5 no navegador para evitar cache da versão anterior.

## Acesso de demonstração

```text
admin / RenBI@2026
gestor / Gestor@2026
financeiro / Finance@2026
```

O login do GitHub Pages é demonstrativo. Em produção, configure a API para que autenticação e bloqueio por licença sejam validados no servidor.
