ALTER TABLE funcionarios
  ADD COLUMN data_desligamento DATE NULL AFTER data_admissao;

UPDATE funcionarios
   SET condicao = 'AFASTADO'
 WHERE situacao = 'AFASTADO' AND COALESCE(condicao, '') = '';

UPDATE funcionarios
   SET situacao = 'ATIVO'
 WHERE situacao = 'AFASTADO';

INSERT IGNORE INTO schema_migrations (versao) VALUES ('021_separa_situacao_condicao');
