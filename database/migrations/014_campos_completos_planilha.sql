ALTER TABLE exames_realizados ADD COLUMN alteracao_glicemia TINYINT(1) NULL AFTER alteracao_pa;
ALTER TABLE acidentes_trabalho
  ADD COLUMN afastamento TINYINT(1) NULL AFTER cat_emitida,
  ADD COLUMN dias_atestado SMALLINT UNSIGNED NULL AFTER afastamento,
  ADD COLUMN cid VARCHAR(20) NULL AFTER dias_atestado;
INSERT IGNORE INTO schema_migrations (versao) VALUES ('014_campos_completos_planilha');
