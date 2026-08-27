ALTER TABLE config_geral
  ADD COLUMN backup_intervalo_dias SMALLINT UNSIGNED NOT NULL DEFAULT 7 AFTER icone_medico,
  ADD COLUMN ultimo_backup_em DATETIME NULL AFTER backup_intervalo_dias;

INSERT IGNORE INTO schema_migrations (versao)
VALUES ('008_backup_completo');
