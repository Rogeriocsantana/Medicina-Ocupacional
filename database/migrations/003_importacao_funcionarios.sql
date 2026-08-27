ALTER TABLE funcionarios
  ADD COLUMN status VARCHAR(40) NULL AFTER data_nascimento,
  ADD COLUMN situacao VARCHAR(20) NOT NULL DEFAULT 'ATIVO' AFTER status;

CREATE TABLE importacoes_funcionarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome_arquivo VARCHAR(255) NOT NULL,
  total_linhas INT UNSIGNED NOT NULL DEFAULT 0,
  linhas_prontas INT UNSIGNED NOT NULL DEFAULT 0,
  linhas_pendentes INT UNSIGNED NOT NULL DEFAULT 0,
  linhas_importadas INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ANALISADO',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_importacoes_funcionarios_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE importacao_empresa_mapeamentos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  importacao_id BIGINT UNSIGNED NOT NULL,
  codigo_origem VARCHAR(120) NOT NULL,
  empresa_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_importacao_empresa_codigo (importacao_id, codigo_origem),
  KEY idx_importacao_empresa_empresa (empresa_id),
  CONSTRAINT fk_importacao_empresa_lote
    FOREIGN KEY (importacao_id) REFERENCES importacoes_funcionarios (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_importacao_empresa_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE importacao_funcionarios_itens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  importacao_id BIGINT UNSIGNED NOT NULL,
  linha_origem INT UNSIGNED NOT NULL,
  numero_origem VARCHAR(50) NULL,
  nome VARCHAR(255) NULL,
  empresa_codigo VARCHAR(120) NULL,
  data_nascimento DATE NULL,
  cpf VARCHAR(20) NULL,
  cpf_normalizado CHAR(11) NULL,
  departamento VARCHAR(200) NULL,
  cargo VARCHAR(200) NULL,
  data_admissao DATE NULL,
  ultimo_exame DATE NULL,
  vencimento DATE NULL,
  status_origem VARCHAR(40) NULL,
  atraso_dias INT NULL,
  situacao_origem VARCHAR(20) NULL,
  conflitos JSON NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  acao VARCHAR(20) NOT NULL DEFAULT 'IMPORTAR',
  funcionario_id BIGINT UNSIGNED NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_importacao_linha (importacao_id, linha_origem),
  KEY idx_importacao_itens_estado (importacao_id, estado),
  KEY idx_importacao_itens_cpf (cpf_normalizado),
  CONSTRAINT fk_importacao_itens_lote
    FOREIGN KEY (importacao_id) REFERENCES importacoes_funcionarios (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_importacao_itens_funcionario
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (versao)
VALUES ('003_importacao_funcionarios');
