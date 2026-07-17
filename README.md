# Gestão Ocupacional — ASO / PCMSO

Sistema local para clínicas de medicina ocupacional. Centraliza cadastros, relacionamentos por cargo e emissão de ASOs em PDF, com dados persistidos em Excel.

## Principais recursos

- Dashboard com indicadores e últimos ASOs emitidos.
- Cadastro de setores, cargos, funcionários, riscos, exames complementares e grupos de risco.
- Busca e paginação com cinco registros por página nas listas administrativas.
- Relacionamentos por cargo:
  - Cargo × riscos ocupacionais;
  - Cargo × exames complementares.
- Emissão de ASO em PDF com riscos e exames determinados pelo cargo atual do funcionário.
- Histórico versionado de ASOs: **Atualizar** cria uma nova emissão e preserva a anterior.
- Download da última versão efetivamente emitida de cada registro.
- Backup automático do banco antes de cada gravação.
- Configurações em abas: clínica, médico, tipos de exame e grupos de risco.
- Nome, especialidade e ícone configurável do médico exibidos no cabeçalho.

## Tecnologias

- Node.js e Express
- EJS
- ExcelJS
- PDFKit
- Tailwind CSS

## Execução local

1. Instale o [Node.js LTS](https://nodejs.org/).
2. Instale as dependências:

```bash
npm install
```

3. Inicie a aplicação:

```bash
npm start
```

4. Acesse `http://127.0.0.1:3737`.

No Windows, também é possível executar `Iniciar_Sistema.bat`.

## Executável Windows

```bash
npm run build:win
```

O executável é gerado em `dist/ASO-PCMSO-ClinicaPierro.exe`.

## Dados, migração e backup

O banco é criado ou migrado automaticamente na inicialização:

```text
dados/banco.xlsx
```

Antes de cada gravação, uma cópia é salva em:

```text
dados/backups/
```

Não mantenha `banco.xlsx` aberto no Excel enquanto o sistema estiver em execução.

## Regras principais

```text
Cargo
 ├── Riscos ocupacionais
 └── Exames complementares
```

- Riscos e exames do ASO são carregados pelo cargo atual.
- Ao atualizar um ASO no histórico, o sistema consulta o cadastro atual do funcionário pelo CPF e cria uma nova emissão.
- Setores, cargos, riscos e exames com vínculos não podem ser excluídos.
- Grupos de risco possuem nome, cor e ordem configuráveis.

## Estrutura

```text
dados/                    Banco Excel e backups
docs/                     Arquitetura, requisitos e regras de interface
public/images/            Logotipos locais
server/                   API, controllers e serviços
views/                    Telas EJS
dist/                     Executável gerado
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Inicia a aplicação. |
| `npm run seed` | Redefine dados de teste. Não utilizar em produção. |
| `npm run build:win` | Gera o executável Windows. |

## Documentação

Consulte [Arquitetura e Requisitos](docs/ARQUITETURA_E_REQUISITOS.md) para o detalhamento das telas, dados e fluxos.

## Privacidade

O sistema trata dados pessoais e ocupacionais. Proteja o computador, restrinja o acesso à pasta `dados/` e mantenha backups em local seguro.
