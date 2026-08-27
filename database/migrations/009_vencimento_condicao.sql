ALTER TABLE perfis_ocupacionais
  ADD COLUMN periodicidade_vencimento_meses SMALLINT UNSIGNED NOT NULL DEFAULT 12 AFTER ativo;

ALTER TABLE funcionarios
  ADD COLUMN condicao VARCHAR(40) NULL AFTER observacao_condicao;

UPDATE funcionarios
   SET condicao = UPPER(TRIM(observacao_condicao)), observacao_condicao = NULL
 WHERE UPPER(TRIM(COALESCE(observacao_condicao, ''))) IN
       ('GESTANTE', 'FÉRIAS', 'FERIAS', 'PUERPÉRIO', 'PUERPERIO', 'LICENÇA MÉDICA', 'LICENCA MEDICA');

UPDATE funcionarios SET condicao = 'FÉRIAS' WHERE condicao = 'FERIAS';
UPDATE funcionarios SET condicao = 'PUERPÉRIO' WHERE condicao = 'PUERPERIO';
UPDATE funcionarios SET condicao = 'LICENÇA MÉDICA' WHERE condicao = 'LICENCA MEDICA';

INSERT IGNORE INTO schema_migrations (versao) VALUES ('009_vencimento_condicao');
