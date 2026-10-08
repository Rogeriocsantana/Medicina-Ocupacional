CREATE TABLE IF NOT EXISTS exames_realizados (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  funcionario_id BIGINT UNSIGNED NOT NULL,
  historico_aso_id BIGINT UNSIGNED NULL,
  data_exame DATE NOT NULL,
  tipo_exame VARCHAR(80) NOT NULL,
  alteracao_pa TINYINT(1) NULL,
  observacao VARCHAR(500) NULL,
  origem ENUM('SISTEMA','IMPORTACAO','MANUAL') NOT NULL DEFAULT 'MANUAL',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exame_historico_aso (historico_aso_id),
  KEY idx_exame_funcionario_data (funcionario_id, data_exame),
  CONSTRAINT fk_exame_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_exame_historico FOREIGN KEY (historico_aso_id) REFERENCES historico_aso(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS acidentes_trabalho (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  funcionario_id BIGINT UNSIGNED NOT NULL,
  data_acidente DATE NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  agente_causador VARCHAR(255) NULL,
  perfurocortante TINYINT(1) NOT NULL DEFAULT 0,
  cat_emitida ENUM('SIM','NAO','PENDENTE') NOT NULL DEFAULT 'PENDENTE',
  acompanhamento_30 DATE NULL,
  acompanhamento_90 DATE NULL,
  observacao VARCHAR(500) NULL,
  origem ENUM('IMPORTACAO','MANUAL') NOT NULL DEFAULT 'MANUAL',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_acidente_funcionario_data (funcionario_id, data_acidente),
  CONSTRAINT fk_acidente_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS encaminhamentos_ocupacionais (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  funcionario_id BIGINT UNSIGNED NOT NULL,
  data_encaminhamento DATE NOT NULL,
  especialidade VARCHAR(150) NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  situacao ENUM('PENDENTE','AGENDADO','CONCLUIDO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  data_conclusao DATE NULL,
  observacao VARCHAR(500) NULL,
  origem ENUM('IMPORTACAO','MANUAL') NOT NULL DEFAULT 'MANUAL',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_encaminhamento_funcionario_data (funcionario_id, data_encaminhamento),
  CONSTRAINT fk_encaminhamento_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE historico_aso ADD COLUMN exame_realizado_id BIGINT UNSIGNED NULL AFTER funcionario_id;
ALTER TABLE historico_aso ADD KEY idx_historico_exame_realizado (exame_realizado_id);
ALTER TABLE historico_aso ADD CONSTRAINT fk_historico_exame_realizado FOREIGN KEY (exame_realizado_id) REFERENCES exames_realizados(id) ON UPDATE CASCADE ON DELETE SET NULL;

INSERT IGNORE INTO schema_migrations (versao) VALUES ('013_registros_ocupacionais_indicadores');
