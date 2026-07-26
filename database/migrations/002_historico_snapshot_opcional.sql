USE medicina_db;

ALTER TABLE historico_aso
  MODIFY documento_snapshot JSON NULL;

INSERT IGNORE INTO schema_migrations (versao)
VALUES ('002_historico_snapshot_opcional');
