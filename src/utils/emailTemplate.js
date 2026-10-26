/**
 * Template de e-mail responsivo e estilizado para recuperação de senha da MontesSquad.
 * Inclui código de verificação numérico em destaque e link direto.
 */
function gerarTemplateRecuperacaoSenha({ nome, codigo, resetUrl }) {
  const primeiroNome = nome ? nome.split(" ")[0] : "Dev";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha - MontesSquad</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Cabeçalho / Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 36px 32px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: rgba(255, 255, 255, 0.12); padding: 8px 20px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 12px;">
                      <span style="color: #c7d2fe; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
                        ⚡ Plataforma MontesSquad
                      </span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">
                      Recuperação de Senha
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo do E-mail -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #0f172a;">
                Olá, ${primeiroNome}! 👋
              </p>
              
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 24px; color: #475569;">
                Recebemos uma solicitação para redefinir a senha da sua conta na <strong>MontesSquad</strong>.
              </p>

              ${codigo ? `
              <!-- Caixa de Destaque do Código de Confirmação -->
              <div style="background-color: #f8fafc; border: 2px dashed #6366f1; border-radius: 12px; padding: 22px 16px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; text-transform: uppercase; color: #4f46e5; letter-spacing: 1.5px;">
                  Seu Código de Confirmação
                </p>
                <div style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #1e1b4b; padding-left: 12px;">
                  ${codigo}
                </div>
                <p style="margin: 10px 0 0; font-size: 13px; color: #64748b;">
                  Insira este código de 6 dígitos no site para validar sua identidade e redefinir a senha.
                </p>
              </div>
              ` : ''}

              ${resetUrl ? `
              <p style="margin: 20px 0 16px; font-size: 14px; line-height: 22px; color: #475569; text-align: center;">
                Ou se preferir, clique no botão abaixo para redefinir diretamente:
              </p>

              <!-- Botão de Ação -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 13px 28px; border-radius: 10px; box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.39); letter-spacing: 0.2px;">
                      Redefinir Minha Senha →
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Aviso de Expiração -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 24px 0 20px;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #92400e;">
                  ⏳ <strong>Importante:</strong> Este código expira em <strong>15 minutos</strong> por motivos de segurança.
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px;">

              <!-- Aviso de Segurança -->
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #94a3b8;">
                Se você não solicitou este código, ignore esta mensagem com segurança. Nenhuma alteração será feita na sua conta sem a confirmação deste código.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © 2026 MontesSquad. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

module.exports = {
  gerarTemplateRecuperacaoSenha,
};
