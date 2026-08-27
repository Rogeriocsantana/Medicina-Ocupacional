ALTER TABLE funcionarios
  ADD COLUMN data_admissao DATE NULL AFTER data_nascimento,
  ADD COLUMN ultimo_exame DATE NULL AFTER data_admissao,
  ADD COLUMN vencimento DATE NULL AFTER ultimo_exame,
  ADD COLUMN observacao_condicao VARCHAR(100) NULL AFTER vencimento,
  ADD KEY idx_funcionarios_vencimento (vencimento);

ALTER TABLE historico_aso
  ADD COLUMN controle_funcionario_anterior JSON NULL AFTER documento_snapshot;

UPDATE historico_aso h
JOIN funcionarios f ON f.cpf = h.cpf
SET h.funcionario_id = f.id
WHERE h.funcionario_id IS NULL;

UPDATE funcionarios f
JOIN (
  SELECT i.cpf_normalizado, i.data_admissao, i.ultimo_exame, i.vencimento,
         i.status_origem, i.situacao_origem
    FROM importacao_funcionarios_itens i
    JOIN (
      SELECT cpf_normalizado, MAX(id) AS id
        FROM importacao_funcionarios_itens
       WHERE estado = 'IMPORTADO' AND cpf_normalizado IS NOT NULL
       GROUP BY cpf_normalizado
    ) ultima ON ultima.id = i.id
) origem ON origem.cpf_normalizado = f.cpf
SET f.data_admissao = origem.data_admissao,
    f.ultimo_exame = origem.ultimo_exame,
    f.vencimento = origem.vencimento,
    f.observacao_condicao = CASE
      WHEN UPPER(COALESCE(origem.status_origem, '')) IN ('', 'NO PRAZO', 'ATRASADO') THEN NULL
      ELSE UPPER(origem.status_origem)
    END,
    f.status = CASE
      WHEN origem.vencimento IS NULL THEN 'SEM VENCIMENTO'
      WHEN origem.vencimento < CURRENT_DATE THEN 'ATRASADO'
      ELSE 'NO PRAZO'
    END;

INSERT IGNORE INTO schema_migrations (versao)
VALUES ('007_controle_vencimento_funcionarios');
