# Gestão Ocupacional — ASO / PCMSO

Sistema para clínicas de medicina ocupacional. Centraliza cadastros, relacionamentos por cargo e emissão de ASOs em PDF, mantendo os dados em MySQL.

## Recursos principais

- Dashboard com indicadores e últimos ASOs emitidos.
- Cadastros de empresas, setores, cargos, funcionários, riscos, exames e grupos de risco.
- Busca e paginação de cinco registros por página nas listas administrativas.
- Relacionamentos por cargo: **Cargo × Riscos** e **Cargo × Exames**.
- Seleção sincronizada entre as abas de relacionamento, com indicadores e status do cargo ativo.
- Geração de ASO em PDF com riscos e exames definidos pelo cargo atual do funcionário.
- Histórico versionado: **Atualizar** cria uma nova emissão com empresa, cargo e setor atuais, preservando a anterior.
- Download baseado no snapshot armazenado na última emissão do registro.
- Persistência relacional no MySQL, com integridade por chaves estrangeiras.
- Cadastro de múltiplas empresas e seleção da empresa no funcionário.
- Configuração independente dos dados do médico coordenador.
- Cadastro nas abas **Tipos de Exames** e **Exames Complementares** da tela Exames.
- Administração de grupos de risco na própria tela de Riscos.
- Funcionamento na raiz do domínio ou em qualquer subdiretório por meio de `BASE_PATH`.
- Compatibilidade com Docker e Nginx Reverse Proxy.
- Datas geradas no fuso horário `America/Sao_Paulo`.

## Tecnologias

- Node.js + Express
- EJS
- MySQL 8 + mysql2
- ExcelJS para futura importação de planilhas
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

O banco é criado sem dados de demonstração. O arquivo `dados/banco.xlsx` é
legado e será utilizado somente como fonte da futura importação dos dados reais.

### Iniciar com Docker

O `compose.yaml` utiliza o contêiner `node:22-alpine`, conecta a aplicação à
rede externa `infra-net` e acessa o MySQL pelo hostname `mysql`.

```bash
docker compose up -d
```

Depois de alterações somente no código:

```bash
docker compose restart
```

Se o Compose ou as variáveis do contêiner forem alterados, recrie o serviço:

```bash
docker compose up -d --force-recreate
```

Com `BASE_PATH=/medicina`, o acesso direto para diagnóstico é:

```text
http://127.0.0.1:3737/medicina/
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
Usuário: hst
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

## Privacidade e segurança

O sistema trata dados pessoais e ocupacionais. Restrinja o acesso à aplicação e
ao MySQL, mantenha o banco fora da internet pública e utilize HTTPS no proxy.
Implemente uma rotina externa de backup do MySQL e teste periodicamente a
restauração. Não envie bancos, planilhas ou PDFs por canais públicos.

O sistema ainda não possui autenticação de usuários. Antes de disponibilizá-lo
fora da rede controlada do hospital, devem ser implementados autenticação,
perfis de acesso e registro de auditoria.

