CREATE TABLE IF NOT EXISTS historico_condicoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  funcionario_id BIGINT UNSIGNED NOT NULL,
  empresa_id BIGINT UNSIGNED NOT NULL,
  condicao VARCHAR(40) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NULL,
  observacao VARCHAR(255) NULL,
  corrigido TINYINT(1) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_condicoes_funcionario (funcionario_id, data_inicio),
  KEY idx_condicoes_relatorio (empresa_id, condicao, data_inicio, data_fim),
  CONSTRAINT fk_condicoes_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_condicoes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS presencas_medicas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa_id BIGINT UNSIGNED NOT NULL,
  data_presenca DATE NOT NULL,
  medico VARCHAR(180) NOT NULL,
  observacao VARCHAR(500) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_presencas_relatorio (empresa_id, data_presenca),
  CONSTRAINT fk_presencas_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
