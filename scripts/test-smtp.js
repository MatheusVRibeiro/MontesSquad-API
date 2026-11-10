require("dotenv").config();
const nodemailer = require("nodemailer");
const { gerarTemplateRecuperacaoSenha } = require("../src/utils/emailTemplate");

async function enviarEmailTeste(destinatario) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = String(process.env.SMTP_SECURE || "true") === "true";
  const from = process.env.SMTP_FROM || `MontesSquad <${user}>`;

  console.log("------------------------------------------");
  console.log("Iniciando envio de e-mail de teste...");
  console.log(`De: ${from}`);
  console.log(`Para: ${destinatario}`);
  console.log(`Host: ${host}:${port} (SSL: ${secure})`);
  console.log("------------------------------------------");

  if (!pass) {
    console.error("❌ ERRO: SMTP_PASSWORD não está preenchido no .env.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  const resetUrl = "http://localhost:5173/resetar-senha?token=teste-token-123456";
  const html = gerarTemplateRecuperacaoSenha({
    nome: "Matheus Ribeiro",
    codigo,
    resetUrl,
  });

  try {
    const info = await transporter.sendMail({
      from,
      to: destinatario,
      subject: `[Teste de Envio] Código de Recuperação: ${codigo} - MontesSquad`,
      html,
    });

    console.log("✅ E-mail enviado com SUCESSO!");
    console.log(`ID da Mensagem: ${info.messageId}`);
    if (info.response) {
      console.log(`Resposta do Servidor: ${info.response}`);
    }
  } catch (error) {
    console.error("❌ Erro ao enviar e-mail:", error);
    process.exit(1);
  }
}

const destinatario = process.argv[2] || "rmatribeiro@gmail.com";
enviarEmailTeste(destinatario);
