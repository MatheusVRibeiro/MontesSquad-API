// Migração segura — Evolução de produto ETAPA 3 (perfil técnico completo)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de ALTER/CREATE.
//
// 1) Colunas em usuarios:
//    - disponibilidade_horas_semana INT NULL
//    - objetivo_profissional VARCHAR(255) NULL
//    - perfil_completo BOOLEAN DEFAULT FALSE
// 2) Tabelas novas:
//    - funcoes (id, nome VARCHAR(100) NOT NULL UNIQUE)
//    - funcoes_usuario (usuario_id, funcao_id, nivel_interesse
//      ENUM('baixo','medio','alto') DEFAULT 'medio', PK composta, FKs CASCADE)
// 3) Seed padrão de 9 funções (INSERT IGNORE — idempotente).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

const FUNCOES_PADRAO = [
  "Backend",
  "Frontend",
  "Full Stack",
  "Mobile",
  "QA",
  "DevOps",
  "UX/UI",
  "Data",
  "Product",
];

async function colunaExiste(conn, tabela, coluna) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.BD_BANCO, tabela, coluna]
  );
  return rows.length > 0;
}

async function tabelaExiste(conn, tabela) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [process.env.BD_BANCO, tabela]
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

  // 1. Colunas em usuarios (idempotente)
  const colunas = [
    ["disponibilidade_horas_semana", "INT NULL"],
    ["objetivo_profissional", "VARCHAR(255) NULL"],
    ["perfil_completo", "BOOLEAN DEFAULT FALSE"],
  ];
  for (const [coluna, definicao] of colunas) {
    if (await colunaExiste(conn, "usuarios", coluna)) {
      console.log(`[migrar_evolucao_etapa3] usuarios.${coluna} já existe — nada a fazer`);
    } else {
      await conn.query(`ALTER TABLE usuarios ADD COLUMN ${coluna} ${definicao}`);
      console.log(`[migrar_evolucao_etapa3] coluna usuarios.${coluna} criada`);
    }
  }

  // 2. Tabela funcoes (idempotente)
  if (await tabelaExiste(conn, "funcoes")) {
    console.log("[migrar_evolucao_etapa3] tabela funcoes já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE funcoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_evolucao_etapa3] tabela funcoes criada");
  }

  // 3. Tabela funcoes_usuario (idempotente)
  if (await tabelaExiste(conn, "funcoes_usuario")) {
    console.log("[migrar_evolucao_etapa3] tabela funcoes_usuario já existe — nada a fazer");
  } else {
    await conn.query(`
      CREATE TABLE funcoes_usuario (
        usuario_id INT NOT NULL,
        funcao_id INT NOT NULL,
        nivel_interesse ENUM('baixo','medio','alto') DEFAULT 'medio',
        PRIMARY KEY (usuario_id, funcao_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log("[migrar_evolucao_etapa3] tabela funcoes_usuario criada");
  }

  // 4. Seed das 9 funções padrão (INSERT IGNORE — idempotente)
  for (const nome of FUNCOES_PADRAO) {
    const [result] = await conn.query("INSERT IGNORE INTO funcoes (nome) VALUES (?)", [nome]);
    if (result.affectedRows > 0) {
      console.log(`[migrar_evolucao_etapa3] seed funcao: ${nome}`);
    }
  }

  // Relatório final
  const [total] = await conn.query("SELECT COUNT(*) AS total FROM funcoes");
  const [perfis] = await conn.query(
    "SELECT COUNT(*) AS total FROM usuarios WHERE perfil_completo = 1"
  );
  console.log(
    `[migrar_evolucao_etapa3] funcoes cadastradas=${total[0].total} | perfis_completos=${perfis[0].total}`
  );

  await conn.end();
  console.log("[migrar_evolucao_etapa3] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa3] ERRO:", e.message);
  process.exit(1);
});
