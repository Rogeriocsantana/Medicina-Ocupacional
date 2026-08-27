-- Gestão Ocupacional - esquema inicial MySQL 8
-- Seguro para reexecução: não remove nem recria tabelas existentes.

SET NAMES utf8mb4;
SET time_zone = '-03:00';

CREATE TABLE IF NOT EXISTS schema_migrations (
  versao VARCHAR(50) NOT NULL PRIMARY KEY,
  aplicado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS empresas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  razao_social VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) NOT NULL,
  endereco VARCHAR(255) NULL,
  bairro VARCHAR(120) NULL,
  cidade_uf VARCHAR(150) NULL,
  cep VARCHAR(10) NULL,
  telefone VARCHAR(30) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_empresas_cnpj (cnpj)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS setores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_setores_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cargos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargos_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grupos_risco (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  cor CHAR(7) NOT NULL,
  ordem INT UNSIGNED NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_grupos_risco_nome (nome),
  KEY idx_grupos_risco_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riscos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  grupo_id BIGINT UNSIGNED NOT NULL,
  descricao TEXT NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_riscos_grupo (grupo_id),
  CONSTRAINT fk_riscos_grupo
    FOREIGN KEY (grupo_id) REFERENCES grupos_risco (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exames_complementares (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(200) NOT NULL,
  ordem INT UNSIGNED NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exames_complementares_nome (nome),
  KEY idx_exames_complementares_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tipos_exame (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chave VARCHAR(80) NOT NULL,
  nome VARCHAR(150) NOT NULL,
  ordem INT UNSIGNED NOT NULL DEFAULT 1,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tipos_exame_chave (chave),
  KEY idx_tipos_exame_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS funcionarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id BIGINT UNSIGNED NOT NULL,
  setor_id BIGINT UNSIGNED NOT NULL,
  cargo_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(255) NOT NULL,
  cpf CHAR(11) NOT NULL,
  data_nascimento DATE NOT NULL,
  data_admissao DATE NULL,
  ultimo_exame DATE NULL,
  vencimento DATE NULL,
  observacao_condicao VARCHAR(100) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_funcionarios_cpf (cpf),
  KEY idx_funcionarios_empresa (empresa_id),
  KEY idx_funcionarios_setor (setor_id),
  KEY idx_funcionarios_cargo (cargo_id),
  KEY idx_funcionarios_nome (nome),
  KEY idx_funcionarios_vencimento (vencimento),
  CONSTRAINT fk_funcionarios_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_funcionarios_setor
    FOREIGN KEY (setor_id) REFERENCES setores (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_funcionarios_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cargo_risco (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cargo_id BIGINT UNSIGNED NOT NULL,
  risco_id BIGINT UNSIGNED NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargo_risco (cargo_id, risco_id),
  KEY idx_cargo_risco_risco (risco_id),
  CONSTRAINT fk_cargo_risco_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cargo_risco_risco
    FOREIGN KEY (risco_id) REFERENCES riscos (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cargo_exame (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cargo_id BIGINT UNSIGNED NOT NULL,
  exame_id BIGINT UNSIGNED NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargo_exame (cargo_id, exame_id),
  KEY idx_cargo_exame_exame (exame_id),
  CONSTRAINT fk_cargo_exame_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cargo_exame_exame
    FOREIGN KEY (exame_id) REFERENCES exames_complementares (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS config_geral (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  hospital_nome VARCHAR(255) NULL,
  medico VARCHAR(255) NOT NULL,
  crm VARCHAR(80) NULL,
  especialidade VARCHAR(150) NULL,
  rqe VARCHAR(80) NULL,
  icone_medico VARCHAR(80) NULL,
  backup_intervalo_dias SMALLINT UNSIGNED NOT NULL DEFAULT 7,
  backup_retencao_dias SMALLINT UNSIGNED NOT NULL DEFAULT 90,
  ultimo_backup_automatico_em DATETIME NULL,
  ultimo_backup_em DATETIME NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_config_geral_unico CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historico_aso (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  funcionario_id BIGINT UNSIGNED NULL,
  empresa_id BIGINT UNSIGNED NULL,
  setor_id BIGINT UNSIGNED NULL,
  cargo_id BIGINT UNSIGNED NULL,
  nome VARCHAR(255) NOT NULL,
  cpf CHAR(11) NOT NULL,
  data_nascimento DATE NOT NULL,
  empresa VARCHAR(255) NOT NULL,
  setor VARCHAR(150) NOT NULL,
  cargo VARCHAR(150) NOT NULL,
  data_geracao DATETIME NOT NULL,
  arquivo_pdf VARCHAR(255) NULL,
  tipo_exame VARCHAR(80) NOT NULL,
  conclusao VARCHAR(80) NULL,
  exames_datas JSON NULL,
  data_avaliacao_clinica DATE NULL,
  riscos_snapshot JSON NULL,
  documento_snapshot JSON NULL,
  controle_funcionario_anterior JSON NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_historico_aso_cpf (cpf),
  KEY idx_historico_aso_data (data_geracao),
  KEY idx_historico_aso_funcionario (funcionario_id),
  KEY idx_historico_aso_empresa (empresa_id),
  CONSTRAINT fk_historico_aso_funcionario
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_historico_aso_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_historico_aso_setor
    FOREIGN KEY (setor_id) REFERENCES setores (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_historico_aso_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (versao) VALUES ('001_esquema_inicial');
