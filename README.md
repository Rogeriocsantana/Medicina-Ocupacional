# Gestão Ocupacional — ASO / PCMSO

Sistema interno do Hospital Santa Tereza para gestão de saúde ocupacional. Centraliza cadastros, perfis ocupacionais, vencimentos, emissão de ASOs e anamneses em PDF, mantendo os dados em MySQL.

**Última release publicada:** `1.2.0`. As alterações posteriores estão descritas em [CHANGELOG.md](CHANGELOG.md), na seção Não publicado.

## Recursos principais

- Dashboard com indicadores e últimos ASOs emitidos.
- Cadastros de empresas, setores, cargos, funcionários, riscos, exames e grupos de risco.
- Busca e paginação: sete itens em setores/cargos, seis em funcionários/riscos/exames e cinco em registros/histórico.
- Relacionamentos por perfil ocupacional: **Setor + Cargo × Riscos** e **Setor + Cargo × Exames**.
- Regras de exames editáveis por perfil, tipo de ASO e periodicidade, com ações para adicionar, remover, cancelar e salvar.
- Perfis usados por colaboradores mas ausentes no PCMSO aparecem como pendentes, sem herdar vínculos de outro setor.
- Geração de ASO em PDF com riscos e exames definidos pelo setor, cargo e tipo de exame atuais do funcionário.
- Histórico versionado: **Atualizar** cria uma nova emissão com empresa, cargo e setor atuais, preservando a anterior.
- Download baseado no snapshot armazenado na última emissão do registro.
- Persistência relacional no MySQL, com integridade por chaves estrangeiras.
- Cadastro de múltiplas empresas e seleção da empresa no funcionário.
- Campos de **status** e **situação** no cadastro do funcionário.
- Código externo opcional do funcionário, único por empresa, exibido antes do nome e pesquisável; filtro de ativos sem código (exceto Só Nutri).
- Registros de exames realizados, acidentes/CAT, encaminhamentos, atestados, condições e presença médica, com modelos XLSX e prévia de importação.
- Condições transitórias com início/fim e sincronização com a edição do cadastro de funcionários.
- Importação segura de funcionários por XLSX, com lote temporário, mapeamento de empresas, validação de CPF e tela de conflitos antes da efetivação.
- Configuração independente dos dados do médico coordenador.
- Cadastro nas abas **Tipos de Exames** e **Exames Complementares** da tela Exames.
- Administração de grupos de risco na própria tela de Riscos.
- Funcionamento na raiz do domínio ou em qualquer subdiretório por meio de `BASE_PATH`.
- Compatibilidade com Docker e Nginx Reverse Proxy.
- Datas geradas no fuso horário `America/Sao_Paulo`.
- Interface responsiva, tema claro/escuro e menu lateral recolhível.
- Preferências visuais configuráveis, seletores pesquisáveis, feedback de ações e modais com título e ações fixos.
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

A versão deste código exige a migração `022_codigo_funcionario`. Antes de atualizar
um ambiente existente, faça backup, aplique as migrações pendentes com credenciais
administrativas e somente depois reinicie a aplicação. `npm run db:migrate` usa
as credenciais `DB_*` do ambiente; não promove o usuário da aplicação a administrador.

Atenção: o Compose atual define `RUN_DB_MIGRATIONS=true`. Com o usuário restrito
`medicina_app`, novas alterações de estrutura serão recusadas. Em produção,
configure esse valor como `false` no Compose depois de executar as migrações
administrativamente. Não amplie as permissões permanentes da aplicação.

Revise as migrações antes de aplicá-las: a `006_carga_pcmso_2026` substitui
catálogos e relacionamentos ocupacionais com o seed institucional. Não reaplique
essa carga em um banco operacional já migrado.

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
Perfil ocupacional (Setor + Cargo)
 ├── Riscos ocupacionais
 └── Exames complementares
```

- Riscos e exames do ASO são carregados pelo perfil atual de setor + cargo e pelas regras do tipo de ASO.
- Cada funcionário pertence a uma empresa cadastrada, cujos dados são usados no cabeçalho do ASO.
- Funcionários possuem admissão, último exame, vencimento e observação/condição. O `Status` (`NO PRAZO`, `ATRASADO` ou `SEM VENCIMENTO`) e os dias de atraso são calculados pelo vencimento. `Situação` aceita `ATIVO` ou `DESLIGADO`, com data de desligamento quando aplicável. Afastamento e demais condições transitórias são gerenciados separadamente, com início e fim.
- Uma nova emissão de ASO, exceto demissional, atualiza o último exame e projeta o vencimento pela periodicidade do perfil (12 meses por padrão). O histórico versiona as datas anteriores; ao excluir a emissão mais recente, o controle anterior do colaborador é restaurado.
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

### Importação de atestados

Na aba **Registros > Atestados**, baixe o modelo atualizado e preencha a aba
**Registros**. A aba **Instruções** explica o preenchimento.

- Informe pelo menos um identificador: **CPF**, **Código Funcionário** ou **Cod + Nome**.
- CPF sozinho identifica o cadastro sem exigir código ou CNPJ.
- Código ou `1109 - NOME` exige **CNPJ da empresa**, pois códigos podem se repetir em empresas distintas.
- Se preencher vários identificadores, todos devem corresponder ao mesmo funcionário.
- O nome do cadastro é preservado; o nome da planilha não altera o cadastro e não é usado sozinho para criar vínculo.
- **Data de Início**, **Tipo** (`DIAS` ou `HORAS`) e **Quantidade** positiva são obrigatórios.
- Confira a prévia: linhas com erro não são importadas. A confirmação revalida o vínculo; registros idênticos por funcionário, início, tipo e quantidade não são inseridos novamente.
- Este fluxo recebe nosso modelo. O relatório original de outro sistema não é um formato de importação suportado.

### Comandos disponíveis

| Comando | Descrição |
| --- | --- |
| `npm start` | Inicia a aplicação. |
| `npm run db:check` | Valida a conexão e a estrutura do MySQL. |
| `npm run db:migrate` | Aplica migrações com as credenciais administrativas fornecidas no ambiente. |
| `CONFIRM_CLEAR_TEST_DATA=SIM npm run db:clear-test-data` | Remove dados operacionais de teste e preserva empresas/configurações. Uso administrativo. |
| `npm run build:win` | Gera o executável Windows. |
| `node --test server/tests/identificadorFuncionario.test.js server/tests/importacaoAtestados.test.js` | Testa os identificadores e a prévia de atestados sem gravar registros. |

## Gerar executável Windows

```bash
npm run build:win
```

O executável será gerado em `dist/ASO-PCMSO-ClinicaPierro.exe`.

## Estrutura do projeto

```text
database/                 Migrações e esquema do MySQL
database/data/            Dados operacionais locais (não versionados)
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

### Antes de enviar ao GitHub

O repositório público deve conter código, migrações, testes e documentação,
não os dados operacionais. `.gitignore` exclui `.env`, planilhas, PDFs,
backups e `database/data/`. O script pontual de preenchimento dos códigos
também permanece local, pois depende do arquivo com os vínculos pessoais.

No GitHub Desktop, confira a lista **Changes** antes do commit. `.gitignore`
não remove arquivos já rastreados: se algum dado sensível já estiver versionado,
interrompa o envio e trate também o histórico. Não publique nomes, CPFs,
atestados ou credenciais. Um repositório privado também não substitui essa proteção.

