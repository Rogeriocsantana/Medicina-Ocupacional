# Changelog

Todas as alterações relevantes deste projeto são documentadas neste arquivo.

## [Não publicado]

### Adicionado

- Registros ocupacionais de exames, acidentes/CAT, encaminhamentos, atestados, condições e presença médica.
- Código externo opcional do funcionário, único por empresa, com pesquisa e filtro de ativos sem código.
- Modelo de atestados com CPF, Código Funcionário, Cod + Nome e CNPJ da empresa, instruções e validação por linha.
- Testes dos identificadores e da prévia de importação de atestados.
- Migrações até `022_codigo_funcionario`.

### Alterado

- Situação do funcionário limitada a ATIVO/DESLIGADO; condições transitórias gerenciadas com início/fim e sincronização no cadastro.
- Sidebar, ícones, tipografia, tema escuro, preferências visuais e feedback de ações padronizados.
- Paginação de setores/cargos com sete itens e funcionários/riscos/exames com seis.
- Modais com título e ações fixos; rolagem restrita ao conteúdo.
- Código, CPF e nascimento alinhados no formulário do funcionário.

### Corrigido

- Texto longo dos seletores limitado ao campo com reticências e nome completo no tooltip.
- Importação de atestados identifica por CPF ou código + CNPJ e recusa identificadores conflitantes.

### Segurança e operação

- Dados pessoais de vínculos, script pontual de carga, planilhas, PDFs e backups locais excluídos do Git.
- Documentação atualizada para migrações administrativas e preservação dos dados em atualizações.

Esta seção descreve mudanças desde a release 1.2.0; não constitui uma nova tag ou publicação no GitHub.

## [1.2.0] - 2026-08-27

### Adicionado

- MySQL como banco operacional, com migrações versionadas em `schema_migrations`.
- Cadastro de múltiplas empresas e vínculo da empresa ao colaborador.
- Importação XLSX em tabelas temporárias, validação de conflitos e atualização seletiva.
- Perfis ocupacionais por setor e cargo, com riscos, exames, tipos de ASO e periodicidade configuráveis.
- Controle de admissão, último exame, vencimento, condição e situação do colaborador.
- Filtros de colaboradores por empresa, setor, status, condição e proximidade do vencimento.
- Anamnese admissional configurável e ficha clínica em PDF separada do ASO.
- Tema claro/escuro, navegação lateral recolhível e tabelas responsivas para dispositivos móveis.
- Backup automático em pasta externa, com frequência e retenção configuráveis.
- Pasta individual para cada backup contendo `.medbackup` e schema SQL.
- Exportação manual do schema MySQL para migração entre servidores.
- Compatibilidade com raiz ou subdiretórios por meio de `BASE_PATH`.

### Alterado

- Histórico de ASOs passou a preservar snapshots imutáveis e o controle ocupacional anterior.
- Relacionamentos, paginação, buscas, seletores e ações foram padronizados.
- Layout do dashboard, cadastros e PDFs foi modernizado e adaptado ao tema escuro.
- Data do documento passou a ser preenchida manualmente após a impressão.

### Segurança e operação

- Escrita e restauração de backups possuem validação de integridade por SHA-256.
- `.env`, dados locais, backups, temporários e artefatos de build permanecem fora do Git.
- O sistema continua sem autenticação própria e deve permanecer protegido pela rede, firewall e proxy reverso.

