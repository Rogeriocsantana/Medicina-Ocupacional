UPDATE perfil_exame_regra regras
JOIN tipos_exame colaborador
  ON colaborador.id = regras.tipo_exame_id
 AND colaborador.chave = 'demissional_colaborador'
JOIN tipos_exame empresa
  ON empresa.chave = 'demissional_empresa'
SET regras.tipo_exame_id = empresa.id;

INSERT IGNORE INTO schema_migrations (versao) VALUES ('017_corrige_regras_demissional_empresa');
