# Gestão Ocupacional — Arquitetura e Requisitos

## Visão geral

Aplicação web local para clínicas de medicina ocupacional. O sistema organiza a estrutura da empresa, funcionários, riscos ocupacionais e exames complementares, além de emitir ASOs em PDF e manter o histórico das emissões.

O projeto prioriza operação simples em desktop, rastreabilidade das emissões e preservação dos documentos já gerados.

## Arquitetura

| Camada | Tecnologia e responsabilidade |
| --- | --- |
| Servidor | Node.js e Express para rotas, regras de negócio e APIs internas. |
| Interface | EJS, JavaScript no navegador e classes utilitárias de estilo. |
| Persistência | Planilha Excel local, manipulada pelo ExcelJS. |
| Documentos | PDFKit para geração dos ASOs. |
| Arquivos | Banco, backups e PDFs permanecem no ambiente local. |

O banco Excel deve permanecer fechado enquanto a aplicação estiver em uso. As gravações usam arquivo temporário e substituição atômica; antes de cada alteração é criada uma cópia de segurança em `dados/backups/`.

## Modelo de dados

| Entidade/planilha | Finalidade |
| --- | --- |
| `Setores` | Setores da empresa. |
| `Cargos` | Cargos ou funções. |
| `Funcionarios` | Nome, CPF, nascimento, setor e cargo do colaborador. |
| `GruposRisco` | Nome, cor e ordem de exibição dos grupos de risco. |
| `Riscos` | Descrição do risco e seu grupo. |
| `Cargo_Risco` | Relação de muitos para muitos entre cargo e risco. |
| `ExamesComplementares` | Nome e ordem dos exames. |
| `Cargo_Exame` | Relação de muitos para muitos entre cargo e exame complementar. |
| `TiposExame` | Tipos de ASO, como admissional e periódico. |
| `ConfigGeral` | Dados da clínica e do médico responsável. |
| `HistoricoPDF` | Emissões, dados de geração e snapshot do documento. |

### Relacionamentos principais

```text
Setor ──< Funcionário >── Cargo
                           ├──< Cargo_Risco >── Risco ──> Grupo de risco
                           └──< Cargo_Exame >── Exame complementar
```

Riscos e exames complementares são definidos pelo cargo. O setor continua sendo um dado do funcionário, sem vínculo direto com exames.

## Regras de negócio

- Um cargo pode ter zero, um ou vários riscos e exames complementares.
- Ao selecionar um funcionário para gerar um ASO, riscos e exames são carregados a partir do cargo atual dele.
- A emissão grava um snapshot completo do documento no histórico. O download sempre usa a última versão emitida daquela linha, não os dados originais em edição.
- A ação **Atualizar** no histórico não sobrescreve a emissão anterior: cria uma nova linha, ordenada pela data de geração mais recente.
- Antes de criar a nova emissão pelo histórico, o sistema busca o funcionário pelo CPF e aplica seu cargo e setor atuais. Por consequência, também aplica os riscos e exames do novo cargo.
- Exclusões são bloqueadas quando há dependências. A mensagem informa o vínculo que precisa ser removido primeiro.
- Setores não podem ser excluídos se usados por funcionários ou histórico; cargos não podem ser excluídos se usados por funcionários, histórico, riscos ou exames; riscos e exames não podem ser excluídos enquanto vinculados a cargos.

## Telas e comportamentos

### Navegação e cabeçalho

- A navegação lateral contém Dashboard, Setores, Cargos, Funcionários, Riscos, Exames, Relacionamentos e Histórico. O título da página de exames permanece **Exames Complementares**.
- Configurações é acessada pelo ícone de engrenagem no cabeçalho superior, e não pelo menu lateral.
- O cabeçalho mostra um ícone médico configurável, o nome do médico e sua especialidade. Esses dados vêm de Configurações.

### Dashboard

- Apresenta indicadores cadastrais e emissões recentes.
- Os cards possuem ícones e animação de entrada discreta.

### Setores, Cargos, Funcionários, Riscos e Exames Complementares

- As telas seguem o mesmo padrão: listagem, pesquisa, inclusão, edição, exclusão e confirmação de ações.
- Setores e cargos permitem busca por nome; funcionários permitem busca por nome ou CPF.
- A tela de Riscos possui as abas **Riscos** e **Grupos de risco**. Nesta segunda aba são administrados nome, cor e ordem dos grupos; a listagem de riscos exibe a cor configurada para cada grupo.
- Exames complementares possuem cadastro próprio e são vinculados posteriormente na tela de Relacionamentos.
- As listagens usam paginação de **cinco itens por página**, evitando barras de rolagem internas extensas.

### Relacionamentos

- Organizada em duas abas: **Cargo × Riscos** e **Cargo × Exames Complementares**.
- Mostra cards de resumo, busca de cargo ao lado do título e lista de cargos paginada.
- Cada aba permite selecionar um cargo e marcar/desmarcar os vínculos correspondentes.
- A seleção é compartilhada entre as abas e preservada durante a paginação. Ao trocar de aba, são exibidos os vínculos do mesmo cargo ativo.
- O total de cargos é fixo; os contadores de riscos e exames passam a mostrar os dados do cargo ativo quando houver seleção. Sem seleção, o status informa quantos cargos não possuem vínculos; com seleção, informa se aquele cargo está **Pendente** ou **Em dia**.
- Os grupos de riscos e suas cores são carregados da tela de Riscos, sem depender de grupos fixos na interface.

### Gerar PDF / ASO

1. Selecionar o funcionário.
2. Carregar seus dados atuais de setor e cargo.
3. Exibir os riscos e exames associados ao cargo.
4. Informar tipo de exame, conclusão e demais campos do documento.
5. Gerar, registrar e baixar o PDF.

### Histórico de ASOs

- Lista emissões em ordem decrescente de data de geração.
- Permite pesquisar, baixar, editar dados da emissão, atualizar e excluir.
- Baixar utiliza o snapshot da última emissão daquela linha.
- Atualizar cria outra emissão preservando a anterior, inclusive quando cargo e setor do funcionário foram alterados.

### Configurações

Possui três abas:

1. **Dados da clínica**: razão social, CNPJ, contatos e endereço.
2. **Médico**: nome, CRM, especialidade, RQE e seleção de ícone médico predefinido.
3. **Tipos de exame**: cadastro, edição e exclusão dos tipos usados na emissão.
Os grupos de risco são administrados na tela de Riscos. As ações de exclusão nas tabelas seguem o mesmo padrão visual da tela de Histórico.

## Operação e limites atuais

- O sistema é local e não possui autenticação ou sincronização entre usuários.
- Os arquivos do banco e dos backups devem ser incluídos na rotina de cópia da clínica.
- Alterações no modelo da planilha são criadas ou ajustadas automaticamente na inicialização da aplicação.
- A manutenção de dados deve respeitar os bloqueios de relacionamento para preservar a integridade dos ASOs históricos.
