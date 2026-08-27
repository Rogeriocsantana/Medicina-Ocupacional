CREATE TABLE IF NOT EXISTS perguntas_anamnese_admissional (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pergunta VARCHAR(255) NOT NULL,
  complemento VARCHAR(120) NULL,
  ordem SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  INDEX idx_perguntas_anamnese_ordem (ordem, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO perguntas_anamnese_admissional (pergunta, complemento, ordem)
SELECT dados.pergunta, dados.complemento, dados.ordem
FROM (
  SELECT 'Antecedentes cirúrgicos?' pergunta, 'Qual?' complemento, 1 ordem UNION ALL
  SELECT 'Pratica atividades físicas?', 'Qual?', 2 UNION ALL
  SELECT 'Fumante?', 'Quantidade de cigarros ao dia?', 3 UNION ALL
  SELECT 'Ingere bebida alcoólica?', 'Frequência?', 4 UNION ALL
  SELECT 'Antecedentes alérgicos?', 'Qual?', 5 UNION ALL
  SELECT 'Gestante?', 'Quantos meses de gestação?', 6 UNION ALL
  SELECT 'Faz uso de entorpecentes?', 'Qual?', 7 UNION ALL
  SELECT 'Portador de reumatismos?', 'Qual?', 8 UNION ALL
  SELECT 'Portador de marcapasso?', 'Qual?', 9 UNION ALL
  SELECT 'Portador de doença oncológica?', 'Qual?', 10 UNION ALL
  SELECT 'Portador de epilepsia/convulsões?', 'Frequência?', 11 UNION ALL
  SELECT 'Portador de hipertensão?', NULL, 12 UNION ALL
  SELECT 'Portador de hipotensão?', NULL, 13 UNION ALL
  SELECT 'Portador de diabetes?', 'Tipo?', 14 UNION ALL
  SELECT 'Faz uso de medicamento prolongado?', 'Qual?', 15 UNION ALL
  SELECT 'Portador de doença cardíaca?', 'Qual?', 16 UNION ALL
  SELECT 'Portador de doença respiratória?', 'Qual?', 17 UNION ALL
  SELECT 'Portador de doença renal?', 'Qual?', 18 UNION ALL
  SELECT 'Portador de doença hematológica?', 'Qual?', 19 UNION ALL
  SELECT 'Alterações psicológicas/psiquiátricas?', 'Quais?', 20 UNION ALL
  SELECT 'Realiza algum tratamento médico?', 'Qual?', 21 UNION ALL
  SELECT 'Antecedentes de acidente cerebrovascular?', 'Qual?', 22 UNION ALL
  SELECT 'É transplantado?', 'Qual transplante realizado?', 23 UNION ALL
  SELECT 'Portador de IST?', 'Qual?', 24 UNION ALL
  SELECT 'Antecedentes vasculares?', 'Qual?', 25 UNION ALL
  SELECT 'Portador de doença de pele?', 'Qual?', 26 UNION ALL
  SELECT 'Portador de doença gástrica?', 'Qual?', 27 UNION ALL
  SELECT 'Portador de doença hepática?', 'Qual?', 28 UNION ALL
  SELECT 'Possui algum antecedente não mencionado?', 'Qual?', 29
) dados
WHERE NOT EXISTS (SELECT 1 FROM perguntas_anamnese_admissional);

INSERT IGNORE INTO schema_migrations (versao) VALUES ('010_perguntas_anamnese');
