ALTER TABLE riscos
  ADD COLUMN agravos TEXT NULL AFTER descricao;

ALTER TABLE tipos_exame
  ADD COLUMN selecionavel_aso TINYINT(1) NOT NULL DEFAULT 1 AFTER ordem;

CREATE TABLE perfis_ocupacionais (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setor_id BIGINT UNSIGNED NOT NULL,
  cargo_id BIGINT UNSIGNED NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_perfil_setor_cargo (setor_id, cargo_id),
  KEY idx_perfil_cargo (cargo_id),
  CONSTRAINT fk_perfil_setor FOREIGN KEY (setor_id) REFERENCES setores (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_perfil_cargo FOREIGN KEY (cargo_id) REFERENCES cargos (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE perfil_risco (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  perfil_id BIGINT UNSIGNED NOT NULL,
  risco_id BIGINT UNSIGNED NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_perfil_risco (perfil_id, risco_id),
  KEY idx_perfil_risco_risco (risco_id),
  CONSTRAINT fk_perfil_risco_perfil FOREIGN KEY (perfil_id) REFERENCES perfis_ocupacionais (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_perfil_risco_risco FOREIGN KEY (risco_id) REFERENCES riscos (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE perfil_exame_regra (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  perfil_id BIGINT UNSIGNED NOT NULL,
  exame_id BIGINT UNSIGNED NOT NULL,
  tipo_exame_id BIGINT UNSIGNED NOT NULL,
  obrigatorio TINYINT(1) NOT NULL DEFAULT 1,
  periodicidade_meses SMALLINT UNSIGNED NULL,
  valor_original VARCHAR(40) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_perfil_exame_tipo (perfil_id, exame_id, tipo_exame_id),
  KEY idx_perfil_exame_exame (exame_id),
  KEY idx_perfil_exame_tipo (tipo_exame_id),
  CONSTRAINT fk_perfil_exame_perfil FOREIGN KEY (perfil_id) REFERENCES perfis_ocupacionais (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_perfil_exame_exame FOREIGN KEY (exame_id) REFERENCES exames_complementares (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_perfil_exame_tipo FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (versao)
VALUES ('005_perfis_ocupacionais');
