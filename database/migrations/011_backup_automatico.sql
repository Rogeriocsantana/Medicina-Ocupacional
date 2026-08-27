ALTER TABLE config_geral
  ADD COLUMN backup_retencao_dias SMALLINT UNSIGNED NOT NULL DEFAULT 90 AFTER backup_intervalo_dias,
  ADD COLUMN ultimo_backup_automatico_em DATETIME NULL AFTER backup_retencao_dias;

INSERT IGNORE INTO schema_migrations (versao) VALUES ('011_backup_automatico');
