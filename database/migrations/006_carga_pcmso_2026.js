const path = require('path');
const seed = require(path.join(__dirname, '..', 'seeds', 'pcmso-2026.json'));

async function getOne(connection, sql, params, label) {
  const [rows] = await connection.query(sql, params);
  if (!rows.length) throw new Error(`${label} não encontrado.`);
  return rows[0];
}

async function getOrCreateCargo(connection, nome) {
  const [rows] = await connection.query('SELECT id, nome FROM cargos WHERE nome = ?', [nome]);
  if (rows.length) {
    if (rows[0].nome !== nome) {
      await connection.query('UPDATE cargos SET nome = ? WHERE id = ?', [nome, rows[0].id]);
    }
    return rows[0].id;
  }
  const [result] = await connection.query('INSERT INTO cargos (nome) VALUES (?)', [nome]);
  return result.insertId;
}

module.exports = async function carregarPcmso2026(connection) {
  await connection.query('DELETE FROM perfil_exame_regra');
  await connection.query('DELETE FROM perfil_risco');
  await connection.query('DELETE FROM perfis_ocupacionais');
  await connection.query('DELETE FROM cargo_exame');
  await connection.query('DELETE FROM cargo_risco');
  await connection.query('DELETE FROM riscos');
  await connection.query('DELETE FROM exames_complementares');
  await connection.query('DELETE FROM tipos_exame');
  await connection.query('DELETE FROM grupos_risco');

  const grupoIds = new Map();
  for (const grupo of seed.grupos) {
    const [result] = await connection.query(
      'INSERT INTO grupos_risco (nome, cor, ordem) VALUES (?, ?, ?)',
      [grupo.nome, grupo.cor, grupo.ordem]
    );
    grupoIds.set(grupo.nome, result.insertId);
  }

  const tipoIds = new Map();
  for (const tipo of seed.tipos_exame) {
    const [result] = await connection.query(
      'INSERT INTO tipos_exame (chave, nome, ordem, selecionavel_aso) VALUES (?, ?, ?, ?)',
      [tipo.chave, tipo.nome, tipo.ordem, tipo.selecionavel_aso ? 1 : 0]
    );
    tipoIds.set(tipo.chave, result.insertId);
  }

  const riskIds = new Map();
  const examIds = new Map();
  let examOrder = 1;

  for (const profile of seed.perfis) {
    const sector = await getOne(
      connection, 'SELECT id FROM setores WHERE nome = ?', [profile.setor], `Setor ${profile.setor}`
    );
    const cargoId = await getOrCreateCargo(connection, profile.cargo);
    const [profileResult] = await connection.query(
      'INSERT INTO perfis_ocupacionais (setor_id, cargo_id, ativo) VALUES (?, ?, 1)',
      [sector.id, cargoId]
    );
    const profileId = profileResult.insertId;

    for (const risk of profile.riscos) {
      const riskKey = JSON.stringify([risk.grupo, risk.fator, risk.agravos]);
      let riskId = riskIds.get(riskKey);
      if (!riskId) {
        const [result] = await connection.query(
          'INSERT INTO riscos (grupo_id, descricao, agravos) VALUES (?, ?, ?)',
          [grupoIds.get(risk.grupo), risk.fator, risk.agravos || null]
        );
        riskId = result.insertId;
        riskIds.set(riskKey, riskId);
      }
      await connection.query(
        'INSERT IGNORE INTO perfil_risco (perfil_id, risco_id) VALUES (?, ?)',
        [profileId, riskId]
      );
    }

    for (const rule of profile.regras_exames) {
      let examId = examIds.get(rule.exame);
      if (!examId) {
        const [result] = await connection.query(
          'INSERT INTO exames_complementares (nome, ordem) VALUES (?, ?)',
          [rule.exame, examOrder++]
        );
        examId = result.insertId;
        examIds.set(rule.exame, examId);
      }
      await connection.query(
        `INSERT INTO perfil_exame_regra
           (perfil_id, exame_id, tipo_exame_id, obrigatorio, periodicidade_meses, valor_original)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           obrigatorio = VALUES(obrigatorio),
           periodicidade_meses = VALUES(periodicidade_meses),
           valor_original = VALUES(valor_original)`,
        [
          profileId, examId, tipoIds.get(rule.tipo), rule.obrigatorio ? 1 : 0,
          rule.periodicidade_meses, rule.valor_original
        ]
      );
    }
  }
};
