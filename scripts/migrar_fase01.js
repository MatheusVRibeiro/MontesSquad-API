// Migração segura FASE-01 — MontesSquad
// Aditiva: não apaga dados. Adiciona colunas faltantes e atualiza senhas do seed para bcrypt.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

(async () => {
  const config = {
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  };

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log("Conectado ao banco remoto.");

    // 1. Verifica colunas existentes na tabela projetos
    const [cols] = await conn.query("SHOW COLUMNS FROM projetos");
    const colNames = cols.map((c) => c.Field);
    console.log("Colunas de projetos:", colNames.join(", "));

    // 2. Adiciona colunas faltantes (idempotente)
    const adicionar = async (nome, definicao) => {
      if (!colNames.includes(nome)) {
        await conn.query(`ALTER TABLE projetos ADD COLUMN ${nome} ${definicao}`);
        console.log(`+ coluna ${nome} adicionada`);
      } else {
        console.log(`= coluna ${nome} já existe`);
      }
    };
    await adicionar("repositorio_url", "VARCHAR(255) NULL");
    await adicionar("figma_url", "VARCHAR(255) NULL");
    await adicionar("discord_url", "VARCHAR(255) NULL");
    await adicionar("documentacao_url", "VARCHAR(255) NULL");

    // 3. Atualiza senhas dos usuários do seed para hashes bcrypt (idempotente por email)
    const hashes = {
      "lucas@email.com": "$2b$10$mQiwd9HjKNJ0Tk0ZpGdTKuSxibJXPMscGOKWKpLsDhEeF8eq51SXG",
      "fernanda@email.com": "$2b$10$LwVpuHzAtesBSnfar6XrAu7pFsl.TYfKUGmpPyOVToyyCbsaKlfIG",
      "roberto@email.com": "$2b$10$2FsrKJyELzOfwTwdcl6ZJeq7cKLwbuepEKlbFCZxds89FYuWaSlaO",
      "juliana@email.com": "$2b$10$HAP4ap.kcZ3pmIFVkUmJs.NMR53Ust0cl6vzSE33YE7njy1T9eoLe",
      "admin@email.com": "$2b$10$abQLUJ/X91xIean1/z6z4.rPB453JpCmME.4Srcqo2cNl/5SNe6Sa",
    };
    for (const [email, hash] of Object.entries(hashes)) {
      const [r] = await conn.query("UPDATE usuarios SET senha = ? WHERE email = ?", [hash, email]);
      console.log(`* senha atualizada para ${email} (affectedRows=${r.affectedRows})`);
    }

    console.log("Migração FASE-01 concluída com sucesso.");
  } catch (e) {
    console.error("ERRO na migração:", e.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
