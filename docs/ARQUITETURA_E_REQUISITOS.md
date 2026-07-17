# Gestão Ocupacional — Especificações para refinamento no Stitch

## Especificação Funcional

Este documento descreve os requisitos funcionais, regras de negócio e diretrizes de interface utilizadas durante o desenvolvimento do sistema Gestão Ocupacional. Ele serve como documentação de apoio para evolução e manutenção do projeto.

## Objetivo do produto

Aplicação web local para uma clínica de medicina ocupacional. Permite cadastrar a estrutura ocupacional da empresa, organizar riscos e exames por cargo, manter funcionários e emitir ASOs (Atestados de Saúde Ocupacional) em PDF.

O público principal é a equipe administrativa e médica da clínica. O sistema deve transmitir segurança, organização, precisão e facilidade de uso, sem parecer um sistema hospitalar complexo.

## Direção visual

- Interface desktop-first, com adaptação para tablet.
- Estilo profissional, limpo, calmo e confiável.
- Fundo claro, superfícies brancas, azul institucional como cor primária.
- Tipografia legível e hierarquia forte para títulos, formulários e tabelas.
- Ícones simples de linha para navegação e ações.
- Componentes com cantos levemente arredondados, bordas sutis e sombras discretas.
- Priorizar contraste, espaços generosos e mensagens de status claras.
- Não usar excesso de gradientes, ilustrações decorativas ou cores saturadas.

### Paleta sugerida

| Papel | Cor sugerida |
|---|---|
| Primária | Azul profundo `#00478D` |
| Ação secundária / seleção | Azul muito claro `#DCE8F8` |
| Fundo geral | `#F8F9FA` |
| Superfície | Branco `#FFFFFF` |
| Texto principal | `#191C21` |
| Texto secundário | `#5E656C` |
| Borda | `#DEE2E6` |
| Erro / exclusão | `#BA1A1A` |
| Sucesso | Verde discreto `#188038` |

## Estrutura global

### Navegação lateral fixa

A navegação fica à esquerda no desktop, com logomarca no topo e botão destacado **Gerar Novo PDF** no rodapé.

Itens de navegação:

1. Dashboard
2. Setores
3. Cargos
4. Funcionários
5. Riscos
6. Exames Complementares
7. Relacionamentos
8. Histórico
9. Configurações

O item ativo deve usar fundo azul claro, ícone preenchido e texto em azul primário. O cabeçalho do conteúdo mostra o nome da clínica e o título da tela atual.

### Padrões reutilizáveis

- Botão primário: azul, ícone à esquerda, usado para criar, salvar ou gerar.
- Botão secundário: neutro, usado para cancelar ou voltar.
- Ação de editar: ícone de lápis azul.
- Ação de excluir: ícone de lixeira vermelho, sempre com confirmação.
- Tabelas: cabeçalho suave, linhas com hover, ações alinhadas à direita.
- Modais: fundo com sobreposição escura suave, título objetivo, campos bem espaçados, ações no rodapé.
- Toasts: canto superior direito para sucesso e erro.
- Estado vazio: ícone leve, explicação curta e CTA para iniciar o cadastro.

---

## Telas

### 1. Dashboard

**Objetivo:** fornecer uma visão rápida da base cadastral e da atividade recente.

**Conteúdo:**

- Título: `Dashboard`.
- Quatro cards de indicadores: total de setores, cargos, riscos e ASOs gerados no mês.
- Card opcional com total geral de ASOs no histórico.
- Tabela `Últimos ASOs gerados`, com nome, CPF mascarado, cargo, setor e data de geração.
- CTA principal: `Gerar Novo PDF`.

**Interações:** clicar em um indicador pode navegar para a tela correspondente; o histórico recente pode levar ao ASO no histórico.

### 2. Setores

**Objetivo:** cadastrar os setores da empresa.

**Conteúdo:**

- Título: `Lista de Setores`.
- Texto auxiliar: setores são usados no cadastro de funcionários e no histórico.
- Botão: `Adicionar Setor`.
- Tabela com ID, nome do setor e ações.
- Modal com um único campo obrigatório: `Nome do setor`.

**Regra importante:** um setor não pode ser removido enquanto for usado por funcionário ou histórico.

### 3. Cargos

**Objetivo:** cadastrar cargos/funções.

**Conteúdo:**

- Título: `Lista de Cargos`.
- Botão: `Adicionar Cargo`.
- Tabela com ID, nome e ações.
- Modal com campo obrigatório `Nome do cargo`.

**Regra importante:** cargos são a base dos vínculos de riscos e exames complementares. A exclusão deve exibir claramente os vínculos existentes.

### 4. Funcionários

**Objetivo:** manter o cadastro dos colaboradores usados para gerar ASOs.

**Conteúdo:**

- Busca por nome ou CPF.
- Botão: `Adicionar Funcionário`.
- Tabela com nome, CPF, nascimento, setor, cargo e ações.
- Modal de cadastro/edição com nome, CPF, data de nascimento, setor e cargo.

**Comportamento:** CPF deve ser formatado e validado. Setor e cargo são selecionados a partir dos cadastros existentes.

### 5. Riscos Ocupacionais

**Objetivo:** cadastrar riscos que serão associados aos cargos.

**Conteúdo:**

- Título: `Lista de Riscos Ocupacionais`.
- Botão: `Adicionar Risco`.
- Tabela com ID, grupo, descrição e ações.
- Grupos padronizados: Biológico, Físico, Químico, Ergonômico e Acidente.
- Cada grupo deve ter um badge de cor consistente.
- Modal com grupo e descrição.

### 6. Exames Complementares

**Objetivo:** cadastrar exames que poderão ser associados a cargos.

**Conteúdo:**

- Título: `Exames Complementares`.
- Texto auxiliar: os exames cadastrados serão vinculados a cargos na tela Relacionamentos.
- Botão: `Adicionar Exame`.
- Tabela com ID, ordem, nome do exame e ações.
- Modal com `Nome` e `Ordem`.

**Regra importante:** um exame não pode ser excluído enquanto estiver associado a algum cargo.

### 7. Relacionamentos

**Objetivo:** configurar o que cada cargo exige/exibe no ASO.

Esta tela possui duas áreas independentes, em sequência vertical:

#### 7.1 Cargo × Riscos

- Coluna esquerda: lista de cargos, com contador de riscos vinculados.
- Painel direito: nome do cargo selecionado e checkboxes agrupados por tipo de risco.
- Botão: `Salvar Vínculos`.
- Deve facilitar a leitura por grupo, com títulos e badges/cores dos grupos.

#### 7.2 Cargo × Exames Complementares

- Coluna esquerda: lista de cargos, com contador de exames vinculados.
- Painel direito: nome do cargo selecionado e lista de checkboxes de exames.
- Botão: `Salvar Vínculos`.
- Estado vazio orientando a cadastrar exames primeiro, quando necessário.

**Regra central:** um cargo pode ter nenhum, um ou vários riscos e exames. Os exames exibidos durante a emissão do ASO são definidos exclusivamente pelo cargo do funcionário.

### 8. Gerar Novo PDF / ASO

**Objetivo:** emitir um ASO a partir de funcionário cadastrado.

**Fluxo principal:**

1. Buscar e selecionar um funcionário por nome ou CPF.
2. Preencher automaticamente nome, CPF, nascimento, setor e cargo.
3. Exibir prévia dos riscos vinculados ao cargo.
4. Exibir somente os exames complementares vinculados ao cargo, cada um com data opcional.
5. Selecionar tipo de exame e conclusão, quando aplicável.
6. Gerar e baixar o PDF.

**Estrutura sugerida:**

- Cabeçalho com título e texto explicativo.
- Card de busca de funcionário destacado.
- Card de dados do colaborador em grid de duas colunas.
- Card de riscos vinculados, em modo somente leitura.
- Painel expansível `Dados opcionais`, contendo avaliação clínica, datas dos exames e conclusão.
- Botão principal fixo/visível: `Gerar PDF`.

**Regras:**

- Riscos e exames são obtidos pelo cargo.
- A emissão cria um registro no histórico e salva um snapshot do conteúdo usado no PDF.

### 9. Histórico de ASOs

**Objetivo:** localizar, baixar, editar, atualizar e excluir emissões.

**Conteúdo:**

- Busca por nome, CPF, cargo ou setor.
- Tabela com nome, CPF, cargo, setor, data de geração e ações.
- Ordenação: data de geração mais recente primeiro.

**Ações por linha:**

- `Baixar`: baixa a última versão efetivamente emitida daquela linha.
- `Editar`: altera os dados pendentes do registro, sem substituir o último PDF emitido.
- `Atualizar`: cria uma **nova linha** no histórico, com data atual e os riscos/exames atuais do cargo. A linha anterior permanece intacta.
- `Excluir`: remove apenas aquele registro, após confirmação.

**Observação visual:** diferenciar claramente `Baixar`, `Editar`, `Atualizar` e `Excluir` por ícone, tooltip e cor. A ação `Atualizar` deve deixar claro que cria uma nova emissão.

### 10. Configurações

**Objetivo:** administrar informações que aparecem no ASO.

**Conteúdo:**

- Formulário de empresa: razão social, CNPJ, telefone, endereço, bairro, cidade/UF, CEP e nome de cabeçalho.
- Formulário de médico coordenador: nome, CRM, especialidade e RQE.
- Área de tipos de exame (admissional, periódico, retorno, mudança de função e demissional), com cadastro, edição e exclusão.

**Nota:** exames complementares possuem uma tela própria e não devem aparecer nesta tela.

---

## Regras de dados e comportamento

- Dados persistidos localmente em uma planilha Excel; a aplicação é destinada a uso em computador local.
- Cada modificação cria uma cópia de segurança do banco antes da substituição.
- Setores, cargos, riscos e exames não podem ser excluídos se ainda tiverem vínculos de uso.
- Ao gerar um ASO, o sistema armazena um snapshot do documento para preservar a versão emitida.
- Ao atualizar um ASO no histórico, cria-se uma nova emissão; o registro anterior não é alterado.
- O PDF é baixado pelo navegador e não precisa ser exibido como tela interna da aplicação.