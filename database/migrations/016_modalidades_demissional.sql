UPDATE tipos_exame
   SET chave = 'demissional_colaborador',
       nome = 'Demissional - colaborador',
       ordem = 6,
       selecionavel_aso = 1
 WHERE chave = 'demissional';

INSERT INTO tipos_exame (chave, nome, ordem, selecionavel_aso)
VALUES ('demissional_empresa', 'Demissional - empresa', 7, 1)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  ordem = VALUES(ordem),
  selecionavel_aso = VALUES(selecionavel_aso);

INSERT IGNORE INTO schema_migrations (versao) VALUES ('016_modalidades_demissional');
