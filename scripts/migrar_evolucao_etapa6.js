// Migração segura — Evolução de produto ETAPA 6 (função do membro com soft-delete)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de ALTER.
//
// Alterações em membros_equipe:
//   vaga_id   INT NULL            (FK → vagas_projeto.id ON DELETE SET NULL)
//   funcao_id INT NULL            (FK → funcoes.id ON DELETE SET NULL)
//   status    ENUM('ativo','saiu','removido') DEFAULT 'ativo'
//   saiu_em   DATETIME NULL
//   CONSTRAINT fk_membros_equipe_vaga
//   CONSTRAINT fk_membros_equipe_funcao
//
// Regras de negócio (validadas nos controllers src/controllers/membros.js e
// candidaturas.js):
//   - remoção/saída de membro é SOFT-DELETE (status='removido'/'saiu', saiu_em=NOW())
//     — histórico preservado; NUNCA DELETE físico;
//   - aprovação de candidatura insere membro com vaga_id (da candidatura) e
//     funcao_id (da vaga — JOIN vagas_projeto.funcao_id) e status='ativo';
//   - remoção/saída de membro com vaga vinculada libera a vaga
//     (preenchidas - 1) e a reabre quando preenchidas < quantidade.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function colunaExiste(conn, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.BD_BANCO, tabela, coluna]
  );
  return rows.length > 0;
}

async function fkExiste(conn, nomeFk) {
  const [rows] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ? AND TABLE_NAME = 'membros_equipe'`,
    [process.env.BD_BANCO, nomeFk]
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  });

  // 1. Coluna membros_equipe.vaga_id (idempotente)
  if (await colunaExiste(conn, "membros_equipe", "vaga_id")) {
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.vaga_id já existe — nada a fazer");
  } else {
    await conn.query("ALTER TABLE membros_equipe ADD COLUMN vaga_id INT NULL AFTER funcao");
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.vaga_id adicionada");
  }

  // 2. Coluna membros_equipe.funcao_id (idempotente)
  if (await colunaExiste(conn, "membros_equipe", "funcao_id")) {
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.funcao_id já existe — nada a fazer");
  } else {
    await conn.query("ALTER TABLE membros_equipe ADD COLUMN funcao_id INT NULL AFTER vaga_id");
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.funcao_id adicionada");
  }

  // 3. Coluna membros_equipe.status (idempotente)
  if (await colunaExiste(conn, "membros_equipe", "status")) {
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.status já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE membros_equipe ADD COLUMN status ENUM('ativo','saiu','removido') DEFAULT 'ativo' AFTER funcao_id"
    );
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.status adicionada");
  }

  // 4. Coluna membros_equipe.saiu_em (idempotente)
  if (await colunaExiste(conn, "membros_equipe", "saiu_em")) {
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.saiu_em já existe — nada a fazer");
  } else {
    await conn.query("ALTER TABLE membros_equipe ADD COLUMN saiu_em DATETIME NULL AFTER status");
    console.log("[migrar_evolucao_etapa6] coluna membros_equipe.saiu_em adicionada");
  }

  // 5. FK fk_membros_equipe_vaga → vagas_projeto(id) ON DELETE SET NULL (idempotente)
  if (await fkExiste(conn, "fk_membros_equipe_vaga")) {
    console.log("[migrar_evolucao_etapa6] FK fk_membros_equipe_vaga já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE membros_equipe ADD CONSTRAINT fk_membros_equipe_vaga " +
        "FOREIGN KEY (vaga_id) REFERENCES vagas_projeto(id) ON DELETE SET NULL"
    );
    console.log("[migrar_evolucao_etapa6] FK fk_membros_equipe_vaga criada");
  }

  // 6. FK fk_membros_equipe_funcao → funcoes(id) ON DELETE SET NULL (idempotente)
  if (await fkExiste(conn, "fk_membros_equipe_funcao")) {
    console.log("[migrar_evolucao_etapa6] FK fk_membros_equipe_funcao já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE membros_equipe ADD CONSTRAINT fk_membros_equipe_funcao " +
        "FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE SET NULL"
    );
    console.log("[migrar_evolucao_etapa6] FK fk_membros_equipe_funcao criada");
  }

  // Relatório final
  const [total] = await conn.query(
    "SELECT COUNT(*) AS total, " +
      "SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) AS ativos, " +
      "SUM(CASE WHEN status != 'ativo' THEN 1 ELSE 0 END) AS inativos, " +
      "SUM(CASE WHEN vaga_id IS NOT NULL THEN 1 ELSE 0 END) AS com_vaga " +
      "FROM membros_equipe"
  );
  const r = total[0];
  console.log(
    `[migrar_evolucao_etapa6] membros=${r.total} ativos=${r.ativos} inativos=${r.inativos} com_vaga=${r.com_vaga}`
  );

  await conn.end();
  console.log("[migrar_evolucao_etapa6] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa6] ERRO:", e.message);
  process.exit(1);
});
