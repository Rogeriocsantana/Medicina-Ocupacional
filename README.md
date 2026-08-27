# Gestão Ocupacional — ASO / PCMSO

Sistema interno do Hospital Santa Tereza para gestão de saúde ocupacional. Centraliza cadastros, perfis ocupacionais, vencimentos, emissão de ASOs e anamneses em PDF, mantendo os dados em MySQL.

**Versão atual:** `1.2.0`

## Recursos principais

- Dashboard com indicadores e últimos ASOs emitidos.
- Cadastros de empresas, setores, cargos, funcionários, riscos, exames e grupos de risco.
- Busca e paginação de cinco registros por página nas listas administrativas.
- Relacionamentos por perfil ocupacional: **Setor + Cargo × Riscos** e **Setor + Cargo × Exames**.
- Regras de exames editáveis por perfil, tipo de ASO e periodicidade, com ações para adicionar, remover, cancelar e salvar.
- Perfis usados por colaboradores mas ausentes no PCMSO aparecem como pendentes, sem herdar vínculos de outro setor.
- Geração de ASO em PDF com riscos e exames definidos pelo setor, cargo e tipo de exame atuais do funcionário.
- Histórico versionado: **Atualizar** cria uma nova emissão com empresa, cargo e setor atuais, preservando a anterior.
- Download baseado no snapshot armazenado na última emissão do registro.
- Persistência relacional no MySQL, com integridade por chaves estrangeiras.
- Cadastro de múltiplas empresas e seleção da empresa no funcionário.
- Campos de **status** e **situação** no cadastro do funcionário.
- Importação segura de funcionários por XLSX, com lote temporário, mapeamento de empresas, validação de CPF e tela de conflitos antes da efetivação.
- Configuração independente dos dados do médico coordenador.
- Cadastro nas abas **Tipos de Exames** e **Exames Complementares** da tela Exames.
- Administração de grupos de risco na própria tela de Riscos.
- Funcionamento na raiz do domínio ou em qualquer subdiretório por meio de `BASE_PATH`.
- Compatibilidade com Docker e Nginx Reverse Proxy.
- Datas geradas no fuso horário `America/Sao_Paulo`.
- Interface responsiva, tema claro/escuro e menu lateral recolhível.
- Anamnese admissional configurável, com questionário e ficha clínica em PDF separado do ASO.
- Backup automático em pasta externa, com frequência, retenção, restauração integral e exportação do schema MySQL.

## Tecnologias

- Node.js + Express
- EJS
- MySQL 8 + mysql2
- ExcelJS para análise e importação de planilhas
- PDFKit
- Tailwind CSS
- Docker Compose
- Nginx como proxy reverso na infraestrutura compartilhada

## Arquitetura atual

```text
Navegador
   │
   ├── acesso direto em desenvolvimento: Node :3737
   │
   └── produção: Nginx /medicina/
                         │
                         ▼
                  Node.js + Express + EJS
                         │
                         ▼
                  MySQL 8 — medicina_db
```

O frontend e a API fazem parte da mesma aplicação. Quando `BASE_PATH=/medicina`,
os endereços são montados automaticamente:

```text
/medicina/                       Interface
/medicina/api/...               API
/medicina/public/...            Recursos estáticos
```

## Como executar

### Pré-requisitos

- Docker e Docker Compose para a execução na infraestrutura atual.
- MySQL 8 disponível na rede Docker `infra-net`.
- Node.js LTS somente para execução direta ou desenvolvimento fora do contêiner.
- Git, caso o projeto seja obtido por repositório.

### Instalação

```bash
git clone <URL_DO_REPOSITORIO>
cd Medicina-Ocupacional
npm install
```

Copie `.env.example` para `.env` e defina, no mínimo:

```env
DB_PASSWORD=senha_do_usuario_mysql
BASE_PATH=/medicina
BACKUP_HOST_DIR=D:/Portal-Medicina-Backups
```

Use `BASE_PATH=` para publicar na raiz.

### Preparar o banco

O banco operacional é `medicina_db`. Em uma instalação nova, execute
[database/mysql-schema.sql](database/mysql-schema.sql) pelo MySQL ou phpMyAdmin.
As alterações posteriores ficam registradas em `database/migrations/` e na
tabela técnica `schema_migrations`.

O esquema contém as tabelas de:

- empresas, setores, cargos e funcionários;
- grupos de risco e riscos;
- tipos de exame e exames complementares;
- vínculos `cargo_risco` e `cargo_exame`;
- configuração geral;
- histórico versionado de ASOs.
- lotes temporários de importação, itens analisados e mapeamentos de empresas.

O banco é criado sem dados de demonstração. Planilhas recebidas entram primeiro
nas tabelas temporárias de importação e não alteram os cadastros até a
efetivação explícita das linhas prontas.

O usuário normal da aplicação deve possuir somente `SELECT`, `INSERT`, `UPDATE`
e `DELETE`. Migrações estruturais devem ser executadas durante a publicação com
um usuário administrativo do MySQL; a aplicação valida a versão pelo conteúdo
de `schema_migrations`.

### Iniciar com Docker

O `compose.yaml` utiliza o contêiner `node:22-alpine`, conecta a aplicação à
rede externa `infra-net`, acessa o MySQL pelo hostname `mysql` e monta a pasta
de backups do servidor em `/backups` dentro do container.

```bash
docker compose up -d app
```

Depois de alterações somente no código:

```bash
docker compose restart app
```

Se o Compose ou as variáveis do contêiner forem alterados, recrie o serviço:

```bash
docker compose up -d --force-recreate
```

Com `BASE_PATH=/medicina`, o acesso pela infraestrutura Nginx é:

```text
http://servidor/medicina/
```

### Iniciar diretamente com Node

Com um MySQL acessível pelas variáveis `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER` e `DB_PASSWORD`:

```bash
npm start
```

No Windows, também é possível iniciar pelo arquivo `Iniciar_Sistema.bat`.

## Para a equipe

Na infraestrutura atual, a conexão utiliza:

```text
Host: mysql
Porta: 3306
Banco: medicina_db
Usuário da aplicação: medicina_app
Fuso horário: America/Sao_Paulo
```

O arquivo `.env` não é versionado. Nunca grave senhas diretamente no código,
no `compose.yaml` ou na documentação.

### Caminho base e proxy reverso

A variável `BASE_PATH` define se a aplicação será publicada na raiz ou em um
subdiretório, sem alteração ou recompilação do código:

```env
BASE_PATH=
```

ou:

```env
BASE_PATH=/medicina
```

Páginas, API, imagens, navegação e downloads são montados automaticamente a
partir dessa configuração central. A mesma versão funciona em:

```text
http://localhost/
http://localhost/medicina/
http://192.168.5.102/medicina/
https://empresa.com/sistemas/medicina/
```

Somente a variável de ambiente muda; não é necessário alterar nem recompilar o
código. Consulte [Publicação em subdiretório com Nginx](docs/NGINX_REVERSE_PROXY.md)
para os exemplos completos.

## Regras de negócio

```text
Cargo
 ├── Riscos ocupacionais
 └── Exames complementares
```

- Riscos e exames do ASO são carregados pelo cargo atual do funcionário.
- Cada funcionário pertence a uma empresa cadastrada, cujos dados são usados no cabeçalho do ASO.
- Funcionários possuem data de admissão, último exame, vencimento e observação/condição. O `Status` (`NO PRAZO`, `ATRASADO` ou `SEM VENCIMENTO`) e os dias de atraso são calculados dinamicamente pelo vencimento; `Situação` permanece controlada entre `ATIVO`, `AFASTADO` e `DESLIGADO`.
- Uma nova emissão de ASO, exceto demissional, atualiza o último exame e projeta o vencimento em 12 meses. O histórico versiona as datas anteriores; ao excluir a emissão mais recente, o controle anterior do colaborador é restaurado.
- A aba **Configurações > Backup** cria um pacote `.medbackup` completo, contendo todas as tabelas de dados e os arquivos institucionais. A restauração valida formato, integridade e compatibilidade de esquema antes de substituir os dados.
- O backup automático cria uma pasta datada dentro de `BACKUP_HOST_DIR`. Cada pasta contém `gestao-ocupacional.medbackup` e `medicina-db-schema.sql`. A frequência (1 a 365 dias) e a retenção (1 a 3650 dias) são configuradas na própria tela; pastas automáticas vencidas são removidas integralmente pelo sistema.
- O botão **Baixar schema SQL** exporta a estrutura completa do MySQL e as versões de migração para preparar um banco vazio em outro servidor. Depois, o conteúdo pode ser restaurado com o `.medbackup`.

### Estratégia de proteção

```text
Código e documentação       Git / release
Dados e arquivos do sistema .medbackup
Estrutura do MySQL          medicina-db-schema.sql
```

Cada execução automática cria uma pasta independente:

```text
D:\Portal-Medicina-Backups\
└── backup-AAAA-MM-DDTHH-MM-SS\
    ├── gestao-ocupacional.medbackup
    └── medicina-db-schema.sql
```

Downloads manuais do schema podem ser arquivados separadamente. A pasta de
backup não deve ficar dentro do repositório Git.

### Recuperação completa

Para recuperar um ambiente vazio, publique a mesma release da aplicação,
importe `medicina-db-schema.sql` em um banco MySQL 8 vazio e configure o `.env`.
Depois, acesse **Configurações > Backup > Restaurar backup**, valide o arquivo
`gestao-ocupacional.medbackup` e confirme a restauração. Cadastros,
configurações, relacionamentos, histórico, controles e imagens institucionais
retornam ao ponto salvo.

No Docker, configure no `.env`, por exemplo
`BACKUP_HOST_DIR=D:/Portal-Medicina-Backups`. O Compose monta essa pasta do
servidor em `/backups` dentro do container. O código-fonte deve continuar
protegido separadamente pelo Git.
- Ao atualizar um ASO no histórico, o sistema busca o funcionário pelo CPF e cria outra emissão com a empresa, o cargo, o setor e os vínculos atuais.
- A emissão salva os dados necessários no histórico; alterações posteriores nos cadastros não modificam o PDF já emitido.
- Setores, cargos, riscos e exames com vínculos ativos não podem ser excluídos.
- Grupos de risco possuem nome, cor e ordem configuráveis.
- Sem cargo selecionado, o status dos relacionamentos informa a quantidade de cargos pendentes; com um cargo selecionado, informa a situação dele.
- Um cargo pode permanecer sem riscos ou exames; o sistema não utiliza vínculos do setor como alternativa.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm start` | Inicia a aplicação. |
| `npm run db:check` | Valida a conexão e a estrutura do MySQL. |
| `npm run db:migrate` | Aplica migrações com as credenciais administrativas fornecidas no ambiente. |
| `CONFIRM_CLEAR_TEST_DATA=SIM npm run db:clear-test-data` | Remove dados operacionais de teste e preserva empresas/configurações. Uso administrativo. |
| `npm run build:win` | Gera o executável Windows. |

## Gerar executável Windows

```bash
npm run build:win
```

O executável será gerado em `dist/ASO-PCMSO-ClinicaPierro.exe`.

## Estrutura do projeto

```text
database/                 Migrações e esquema do MySQL
dados/                    Banco Excel legado (não operacional)
docs/                     Arquitetura e requisitos
public/                   Arquivos estáticos e imagens
server/                   Configuração, rotas, controllers e serviços
views/                    Telas EJS
dist/                     Executável gerado (não versionado)
```

## Documentação

- [Arquitetura e Requisitos](docs/ARQUITETURA_E_REQUISITOS.md)
- [Publicação em subdiretório com Nginx](docs/NGINX_REVERSE_PROXY.md)
- [Notas da release v1.2.0](docs/RELEASE_V1.2.0.md)
- [Histórico de versões](CHANGELOG.md)

## Privacidade e segurança

O sistema trata dados pessoais e ocupacionais. Restrinja o acesso à aplicação e
ao MySQL, mantenha o banco fora da internet pública e utilize HTTPS no proxy.
Proteja a pasta automática, mantenha uma cópia adicional fora do servidor
principal e teste periodicamente a restauração. Não envie bancos, backups,
planilhas ou PDFs por canais públicos.

Por decisão do projeto, o sistema não possui autenticação própria. Portanto, o
acesso deve permanecer restrito pela rede do hospital, firewall e proxy
reverso. O endpoint de diagnóstico só é habilitado quando
`ENABLE_DEBUG_DUMP=true` for definido explicitamente.

