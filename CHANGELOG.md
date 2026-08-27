# Changelog

Todas as alterações relevantes deste projeto são documentadas neste arquivo.

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

