# Gestão Ocupacional — ASO / PCMSO

Sistema local para gestão ocupacional, cadastro de colaboradores e emissão de ASOs em PDF. Desenvolvido para uso em clínica, com dados armazenados localmente em uma planilha Excel.

> O projeto é destinado a um único usuário por vez no mesmo computador. Não requer banco de dados externo.

## Funcionalidades

- Dashboard com indicadores e últimos ASOs emitidos.
- Cadastro de setores, cargos, funcionários e riscos ocupacionais.
- Cadastro independente de exames complementares.
- Relacionamentos por cargo:
  - Cargo × Riscos ocupacionais;
  - Cargo × Exames complementares.
- Geração de ASO em PDF a partir do funcionário cadastrado.
- Inclusão automática de riscos e exames conforme o cargo atual do funcionário.
- Histórico de emissões com busca, download, edição, atualização e exclusão.
- Atualização do histórico cria uma **nova emissão**, mantendo a anterior intacta.
- Snapshot do documento emitido para preservar a última versão disponível para download.
- Paginação nas listas administrativas.
- Configurações da empresa, médico coordenador e tipos de exame.
- Backup automático do banco Excel antes de cada gravação.

## Tecnologias

- Node.js
- Express
- EJS
- ExcelJS
- PDFKit
- Tailwind CSS via CDN

## Como executar

### Com Node.js

1. Instale o [Node.js LTS](https://nodejs.org/).
2. Clone o repositório.
3. Instale as dependências:

```bash
npm install
```

4. Inicie a aplicação:

```bash
npm start
```

5. Acesse no navegador:

```text
http://127.0.0.1:3737
```

No Windows, também é possível executar `Iniciar_Sistema.bat`.

## Executável Windows

Para gerar a versão executável:

```bash
npm run build:win
```

O arquivo será criado em `dist/ASO-PCMSO-ClinicaPierro.exe`.

## Dados e backup

O banco é criado automaticamente em:

```text
dados/banco.xlsx
```

Antes de cada alteração, uma cópia do banco anterior é salva em:

```text
dados/backups/
```

Recomenda-se realizar cópias periódicas da pasta `dados/` em local seguro.

> Não mantenha `banco.xlsx` aberto no Excel enquanto o sistema estiver em execução.

## Regras de relacionamento

Os riscos e exames complementares são vinculados diretamente ao cargo.

```text
Cargo
 ├── Riscos ocupacionais
 └── Exames complementares
```

Durante a emissão ou atualização de um ASO, o sistema utiliza os vínculos do cargo atual do funcionário.

## Histórico de ASOs

| Ação | Comportamento |
|---|---|
| Baixar | Baixa a última versão efetivamente emitida daquele registro. |
| Editar | Altera os dados do registro sem substituir o PDF já emitido. |
| Atualizar | Cria uma nova linha no histórico, com dados, cargo, setor, riscos e exames atuais do funcionário. |
| Excluir | Remove somente a emissão selecionada. |

## Estrutura do projeto

```text
dados/                    Banco Excel e cópias de segurança
public/images/            Logotipos locais
server/
  controllers/            Regras de cada fluxo
  services/               Leitura do Excel e geração de PDF
  routes/                 Rotas da API
views/                    Telas EJS
dist/                     Executável Windows gerado
```

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o sistema localmente. |
| `npm run seed` | Cria/redefine dados de teste. **Não utilizar em produção.** |
| `npm run build:win` | Gera o executável Windows. |

## Segurança e privacidade

O sistema trata dados pessoais e ocupacionais. Proteja o computador de uso, mantenha os backups em local seguro e limite o acesso à pasta `dados/` às pessoas autorizadas.
