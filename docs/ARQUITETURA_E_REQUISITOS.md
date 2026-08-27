# Gestão Ocupacional — Arquitetura e Requisitos

## Visão geral

Aplicação web local para clínicas de medicina ocupacional. O sistema organiza a estrutura da empresa, funcionários, riscos ocupacionais e exames complementares, além de emitir ASOs em PDF e manter o histórico das emissões.

O projeto prioriza operação simples em desktop, rastreabilidade das emissões e preservação dos documentos já gerados.

## Arquitetura

| Camada | Tecnologia e responsabilidade |
| --- | --- |
| Servidor | Node.js e Express para rotas, regras de negócio e APIs internas. |
| Interface | EJS, JavaScript no navegador e classes utilitárias de estilo. |
| Persistência | MySQL 8, acessado pelo driver mysql2. |
| Documentos | PDFKit para geração dos ASOs. |
| Arquivos | Banco, backups e PDFs permanecem no ambiente local. |

O banco operacional é `medicina_db`, acessado pelo hostname `mysql` dentro da rede Docker `infra-net`. O arquivo Excel anterior permanece somente como fonte legada e não recebe novas gravações.

## Modelo de dados

| Entidade/tabela | Finalidade |
| --- | --- |
| `Setores` | Setores da empresa. |
| `Cargos` | Cargos ou funções. |
| `Empresas` | Razão social, CNPJ, endereço e contatos das empresas atendidas. |
| `Funcionarios` | Nome, CPF, nascimento, admissão, último exame, vencimento, observação/condição, empresa, setor, cargo e situação. Status e atraso são derivados dinamicamente do vencimento. |
| `GruposRisco` | Nome, cor e ordem de exibição dos grupos de risco. |
| `Riscos` | Descrição do risco e seu grupo. |
| `Cargo_Risco` | Relação de muitos para muitos entre cargo e risco. |
| `ExamesComplementares` | Nome e ordem dos exames. |
| `Cargo_Exame` | Relação de muitos para muitos entre cargo e exame complementar. |
| `TiposExame` | Tipos de ASO, como admissional e periódico. |
| `ConfigGeral` | Dados do médico responsável e preferências gerais. |
| `HistoricoPDF` | Emissões, dados de geração e snapshot do documento. |
| `ImportacoesFuncionarios` | Lotes temporários recebidos por XLSX. |
| `ImportacaoFuncionariosItens` | Linhas originais, valores normalizados, conflitos e ação escolhida. |
| `ImportacaoEmpresaMapeamentos` | Associação explícita entre o código da planilha e uma empresa cadastrada. |

### Relacionamentos principais

```text
Empresa ──< Funcionário >── Setor
                         └── Cargo
                           ├──< Cargo_Risco >── Risco ──> Grupo de risco
                           └──< Cargo_Exame >── Exame complementar
```

Riscos e exames complementares são definidos pelo cargo. O setor continua sendo um dado do funcionário, sem vínculo direto com exames.

## Regras de negócio

- Um cargo pode ter zero, um ou vários riscos e exames complementares.
- Todo funcionário deve estar vinculado a uma empresa cadastrada.
- Ao selecionar um funcionário para gerar um ASO, riscos e exames são carregados a partir do cargo atual dele.
- A emissão grava um snapshot completo do documento no histórico. O download sempre usa a última versão emitida daquela linha, não os dados originais em edição.
- A ação **Atualizar** no histórico não sobrescreve a emissão anterior: cria uma nova linha, ordenada pela data de geração mais recente.
- Antes de criar a nova emissão pelo histórico, o sistema busca o funcionário pelo CPF e aplica sua empresa, cargo e setor atuais. Por consequência, também aplica os riscos e exames do novo cargo.
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
- Exames complementares possuem cadastro próprio e são vinculados posteriormente aos perfis ocupacionais.
- A tela **Exames** possui as abas **Tipos de Exames** e **Exames Complementares**. Os tipos distinguem as cinco modalidades selecionáveis de ASO e o acompanhamento após admissão; os exames complementares são associados por perfil, tipo e periodicidade.
- As listagens usam paginação de **cinco itens por página**, evitando barras de rolagem internas extensas.

### Relacionamentos

- Organizada em duas abas: **Perfil × Riscos** e **Perfil × Exames**.
- O perfil ocupacional é a combinação única de setor e cargo; um mesmo cargo pode ter riscos e exames diferentes conforme o setor.
- Mostra cards de resumo, busca por setor ou cargo e lista paginada de perfis.
- Perfis importados do PCMSO exibem riscos e regras de exames por tipo e periodicidade. As regras podem ser adicionadas, removidas, canceladas ou salvas pela interface. Combinações usadas por colaboradores mas ausentes no documento aparecem explicitamente como pendentes.
- Emissões de ASO não demissionais atualizam o controle ocupacional do colaborador usando a data da avaliação clínica ou, quando ausente, a data de emissão. O próximo vencimento é projetado em 12 meses. Cada emissão guarda o controle anterior, permitindo restaurá-lo quando a emissão mais recente é excluída.
- O backup lógico completo usa o formato comprimido `.medbackup`, com checksum SHA-256, todas as tabelas funcionais e arquivos institucionais permitidos. A restauração exige compatibilidade exata do esquema, validação prévia e confirmação explícita; a troca dos dados ocorre em transação com as relações restauradas pelos IDs originais.
- `config_geral.backup_intervalo_dias`, `backup_retencao_dias` e `ultimo_backup_automatico_em` controlam o agendamento. Cada execução cria uma pasta contendo o `.medbackup` e o schema SQL; não existe mais alerta global.
- Os grupos de riscos e suas cores são carregados da tela de Riscos, sem depender de grupos fixos na interface.

### Gerar PDF / ASO

1. Selecionar o funcionário.
2. Carregar seus dados atuais de setor e cargo.
3. Exibir os riscos e exames associados à combinação de setor, cargo e tipo de exame.
4. Informar tipo de exame, conclusão e demais campos do documento.
5. Gerar, registrar e baixar o PDF.

A primeira emissão só é inserida no histórico depois que o PDF e o snapshot
completo forem gerados com sucesso. Grupos de risco personalizados também são
incluídos no documento e na pré-visualização.

### Importação de funcionários

1. O XLSX é lido sem modificar o arquivo original.
2. Cada linha é gravada em um lote temporário.
3. O sistema valida CPF, duplicidade, nascimento, departamento, cargo e empresa.
4. Os códigos da coluna de empresa devem ser mapeados explicitamente.
5. Linhas conflitantes permanecem pendentes ou podem ser ignoradas.
6. Somente linhas prontas são efetivadas; setores e cargos inexistentes são criados nesse momento.

O status e a situação da planilha são preservados no funcionário. As colunas de
último exame, vencimento e atraso permanecem no item temporário para uma futura
etapa de controle de periódicos e não são descartadas durante a conferência.

### Histórico de ASOs

- Lista emissões em ordem decrescente de data de geração.
- Permite pesquisar, baixar, editar dados da emissão, atualizar e excluir.
- Baixar utiliza o snapshot da última emissão daquela linha.
- Atualizar cria outra emissão preservando a anterior, inclusive quando cargo e setor do funcionário foram alterados.

### Configurações

Possui duas abas:

1. **Empresas**: cadastro, edição e exclusão das empresas disponíveis no cadastro de funcionários.
2. **Médico**: nome, CRM, especialidade, RQE e seleção de ícone médico predefinido.
Os grupos de risco são administrados na tela de Riscos. As ações de exclusão nas tabelas seguem o mesmo padrão visual da tela de Histórico.

## Operação e limites atuais

- Por decisão do projeto, o sistema não possui autenticação própria. O acesso deve ser limitado pela rede, firewall e proxy reverso do hospital.
- A pasta automática deve ser protegida e copiada periodicamente para outro dispositivo ou servidor; a restauração do `.medbackup` deve ser testada.
- Alterações estruturais são versionadas em `database/mysql-schema.sql`, `database/migrations/` e `schema_migrations`. Migrações exigem usuário administrativo; a aplicação opera com privilégios de dados restritos.
- A senha do banco é fornecida por variável de ambiente e não deve ser versionada.
- A manutenção de dados deve respeitar os bloqueios de relacionamento para preservar a integridade dos ASOs históricos.
