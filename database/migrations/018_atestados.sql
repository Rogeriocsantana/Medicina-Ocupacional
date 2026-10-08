CREATE TABLE IF NOT EXISTS atestados_medicos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  funcionario_id BIGINT UNSIGNED NOT NULL,
  data_emissao DATE NOT NULL,
  data_inicio DATE NOT NULL,
  data_retorno DATE NULL,
  tipo ENUM('DIAS','HORAS') NOT NULL DEFAULT 'DIAS',
  quantidade DECIMAL(8,2) NOT NULL,
  cid VARCHAR(20) NULL,
  profissional VARCHAR(180) NULL,
  registro_profissional VARCHAR(50) NULL,
  cnes VARCHAR(30) NULL,
  afastamento_inss TINYINT(1) NOT NULL DEFAULT 0,
  observacao VARCHAR(1000) NULL,
  origem ENUM('IMPORTACAO','MANUAL') NOT NULL DEFAULT 'MANUAL',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_atestado_funcionario_inicio (funcionario_id, data_inicio),
  KEY idx_atestado_cid (cid),
  CONSTRAINT fk_atestado_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (versao) VALUES ('018_atestados');
