# Atualização pelo GitHub Desktop

## Mensagem do commit

Summary:

```text
feat: atualiza cadastros, registros ocupacionais e interface
```

Description:

```text
Adiciona código do funcionário e filtro de cadastros sem código.
Atualiza modelo e importação de atestados com CPF ou código + CNPJ.
Separa situação funcional de condições transitórias com início e fim.
Padroniza sidebar, tipografia, seletores, paginação e modais.
Atualiza README, changelog e proteção de dados locais no Git.
Inclui migração 022 e testes dos identificadores/importação de atestados.
```

## Antes do commit

1. Trabalhe no clone do repositório existente `Rogeriocsantana/Medicina-Ocupacional`.
   Esta pasta de trabalho não tinha `.git` durante a preparação. Não substitua
   o histórico por um repositório novo e não use force push. Se necessário,
   clone o repositório pelo Desktop em outra pasta e copie o código atualizado
   para o clone, preservando o `.git` dele e o `.gitignore` preparado.
2. Revise **Changes**. Não selecione `.env`, `database/data/`, o script pontual
   `server/preencher-codigos-funcionarios.js`, planilhas, PDFs ou backups.
3. Confirme que `database/migrations/022_codigo_funcionario.sql`, os serviços,
   telas, testes, README, CHANGELOG e `.gitignore` estão incluídos.
4. Se aparecerem arquivos pessoais já rastreados, pare antes do envio.
   `.gitignore` não elimina dados já presentes no histórico do Git.
5. Execute os testes com Node e dependências instaladas:

```bash
node --test server/tests/identificadorFuncionario.test.js server/tests/importacaoAtestados.test.js
```

Depois use **Commit** e **Push origin**. Não crie uma nova release/tag ainda:
`package.json` permanece em 1.2.0 e o CHANGELOG registra a atualização em
**Não publicado**. Uma nova versão deve ser escolhida e alinhada separadamente.

## Dados e publicação

Os códigos preenchidos no banco não viajam com o commit. Para preservar os
cadastros use o backup operacional `.medbackup`, em armazenamento privado.
O Git guarda o código e a migração da coluna, não o cadastro dos funcionários.

O push não publica nem migra automaticamente o servidor. Em outro ambiente,
faça backup, execute as migrações pendentes com um usuário administrativo,
publique o código e reinicie somente o serviço da Medicina. A migração 022
adiciona a coluna opcional e a unicidade por empresa, sem preencher códigos.
