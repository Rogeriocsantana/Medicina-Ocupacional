# Sistema Gerador de ASO / PCMSO — Clínica Pierro

Aplicação web **local e offline** para cadastro de Setores, Cargos e Riscos Ocupacionais,
relacionamento Cargo × Riscos, geração de PDFs de ASO (Atestado de Saúde Ocupacional)
e histórico com edição, download e regeração.

Projetado para **uso por uma única pessoa** no computador da clínica. Todos os dados
ficam em uma planilha Excel (`dados/banco.xlsx`), criada automaticamente na primeira
execução. Não há banco de dados externo (SQLite, MySQL, etc.).

---

## Como rodar (desenvolvimento / uso com Node.js)

1. Instale o Node.js LTS (apenas uma vez): https://nodejs.org/
2. Dê duplo clique em **`Iniciar_Sistema.bat`**
   - Na primeira vez, baixa as dependências (`npm install`) — precisa de internet só nesse passo.
   - Nas próximas vezes, abre direto.
3. O navegador abre em `http://127.0.0.1:3737`
4. Para encerrar, feche a janela preta do terminal.

### Linha de comando (opcional)

```bash
npm install     # apenas na primeira vez
npm start       # http://127.0.0.1:3737
```

---

## Como rodar na clínica (sem Node.js)

Em um computador com Node.js e internet, gere o executável:

```bash
npm install
npm run build:win
```

Ou dê duplo clique em **`Gerar-exe.bat`**.

Isso cria `dist/ASO-PCMSO-ClinicaPierro.exe`. Copie a pasta **`dist`** inteira
(`.exe` + `Iniciar.bat` + `LEIA-ME.txt`) para o PC da clínica e execute
`Iniciar.bat`. Na primeira execução, a pasta `dados/` é criada ao lado do `.exe`.

---

## Backup

Copie a pasta **`dados/`** (contém `banco.xlsx`). É o único lugar onde os cadastros
e o histórico ficam salvos. Os PDFs **não** são armazenados no disco — são gerados
sob demanda e baixados pelo navegador.

---

## Banco de teste (desenvolvimento)

O projeto pode incluir um `dados/banco.xlsx` pré-preenchido para testes. Para resetar:

```bash
npm run seed
```

**Não use `npm run seed` em produção** — apaga todos os dados reais.

---

## Logos

| Arquivo | Uso |
|---------|-----|
| `public/images/logo-icone.jpg` | Menu lateral do site |
| `public/images/logo-completo.png` | Cabeçalho do PDF gerado |

Para trocar as logos, substitua os arquivos em `public/images/` (ou em
`dados/public/images/` ao usar o `.exe`, que tem prioridade).

---

## Estrutura do projeto

```
dados/              -> banco.xlsx (Setores, Cargos, Funcionarios, Riscos, Historico...)
public/images/      -> logos
views/              -> páginas EJS (interface)
server/
  index.js          -> servidor Express (porta 3737)
  routes/api.js     -> API REST
  controllers/      -> lógica de cada tela
  services/
    excelService.js -> leitura/escrita do Excel
    pdfService.js   -> geração do PDF do ASO
```

---

## Funcionalidades

- **Dashboard** — totais de setores, cargos, riscos e ASOs do mês.
- **Setores / Cargos / Funcionários / Riscos** — cadastro completo (CRUD).
- **Relacionamento** — vincula riscos a cada cargo.
- **Gerar Novo PDF** — busque um funcionário cadastrado ou preencha manualmente; nome, CPF, data de nascimento, setor, cargo e tipo de exame.
  Riscos do cargo entram automaticamente no PDF (ordem: Biológico → Físico → Químico → Ergonômico → Acidente).
  Exames complementares, conclusão e data da avaliação clínica são **opcionais** (ficam em branco no PDF para preencher a caneta).
- **Histórico** — busca e quatro ações por registro:
  - **Baixar** — reproduz o ASO como foi salvo (data, cargo/setor e riscos da época).
  - **Editar** — abre o formulário preenchido; ao salvar, atualiza o **mesmo** registro (não cria outro).
  - **Atualizar** — muda a data de geração e recarrega riscos/cargo com os relacionamentos atuais.
  - **Excluir** — remove o registro do histórico.
- **Configurações** — dados da empresa, médico coordenador, tipos de exame e exames complementares.

---

## Dados da empresa e médico

Os dados padrão (razão social, CNPJ, endereço, médico, CRM, etc.) vêm pré-preenchidos
no `banco.xlsx` e podem ser alterados em **Configurações** na interface — não é
necessário editar código.

---

## Observações técnicas

- PDF gerado com **PDFKit** (texto pesquisável, não é imagem).
- O Excel é lido e escrito a cada operação; adequado para **um usuário** no mesmo PC.
- Não abra `banco.xlsx` no Excel enquanto o sistema estiver rodando.
- A interface usa Tailwind via CDN na primeira carga; depois pode funcionar com cache do navegador.
- Na reimpressão: **Baixar** usa o snapshot salvo; **Atualizar** recarrega riscos e data atuais.
