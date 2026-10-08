ALTER TABLE importacao_funcionarios_itens
  ADD COLUMN condicao_origem VARCHAR(40) NULL AFTER status_origem,
  ADD COLUMN observacao_condicao_origem VARCHAR(255) NULL AFTER condicao_origem;

INSERT IGNORE INTO schema_migrations (versao)
VALUES ('012_modelo_importacao_funcionarios');
