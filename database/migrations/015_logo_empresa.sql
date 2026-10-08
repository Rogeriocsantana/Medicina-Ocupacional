ALTER TABLE empresas ADD COLUMN logo_data LONGTEXT NULL AFTER telefone;

INSERT IGNORE INTO schema_migrations (versao) VALUES ('015_logo_empresa');
