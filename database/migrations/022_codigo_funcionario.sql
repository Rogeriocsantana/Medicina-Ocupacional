ALTER TABLE funcionarios ADD COLUMN codigo_funcionario VARCHAR(30) NULL;
CREATE UNIQUE INDEX uq_funcionarios_empresa_codigo ON funcionarios (empresa_id, codigo_funcionario);
