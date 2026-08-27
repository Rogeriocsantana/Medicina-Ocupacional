# Gestão Ocupacional v1.2.0

Esta versão consolida a migração para MySQL, a gestão completa dos perfis ocupacionais e a preparação operacional do sistema para uso na infraestrutura Docker do Hospital Santa Tereza.

## Destaques

- Gestão de empresas, setores, cargos e colaboradores com importação segura por XLSX.
- Riscos e exames relacionados por perfil ocupacional, modalidade de ASO e periodicidade.
- Emissão de ASO e ficha clínica/anamnese em PDFs separados.
- Histórico versionado com snapshots imutáveis e restauração do controle anterior ao excluir a emissão mais recente.
- Dashboard ocupacional, filtros de vencimento e tratamento de condições que não devem aparecer como atraso.
- Interface responsiva, tema claro/escuro e navegação lateral recolhível.
- Publicação atrás do Nginx tanto na raiz quanto em subdiretórios como `/medicina/`.

## Backup e migração

O backup automático cria uma pasta datada com:

```text
backup-AAAA-MM-DDTHH-MM-SS/
├── gestao-ocupacional.medbackup
└── medicina-db-schema.sql
```

A frequência e a retenção são configuradas em **Configurações > Backup**. O caminho físico é definido no `.env` por `BACKUP_HOST_DIR`.

Para migrar para outro servidor:

1. Publique o código desta mesma release.
2. Crie um banco MySQL 8 vazio.
3. Importe `medicina-db-schema.sql` no banco escolhido.
4. Configure as variáveis do banco e inicie a aplicação.
5. Em **Configurações > Backup**, valide e restaure `gestao-ocupacional.medbackup`.
6. Confira empresas, colaboradores, relacionamentos, histórico e imagens institucionais.

## Atualização

Antes de atualizar, gere um backup completo e preserve a pasta fora do diretório do projeto. Depois:

```bash
docker compose up -d --build --force-recreate app
docker compose logs app --tail=100
```

Confirme que a aplicação responde no caminho configurado em `BASE_PATH` e que a aba de backup informa **Pasta acessível**.

## Observações de segurança

- Não envie `.env`, backups, planilhas ou dados ocupacionais ao Git.
- O sistema não possui login próprio; restrinja o acesso pela rede, firewall e proxy reverso.
- Proteja a pasta de backup e mantenha uma cópia adicional fora do servidor principal.

