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
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 20px 12px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Cabeçalho / Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 20px 24px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: rgba(255, 255, 255, 0.12); padding: 4px 14px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 8px;">
                      <span style="color: #c7d2fe; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
                        ⚡ Plataforma MontesSquad
                      </span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 21px; font-weight: 800; margin: 0; letter-spacing: -0.3px;">
                      Recuperação de Senha
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo do E-mail -->
          <tr>
            <td style="padding: 24px 24px 20px;">
              <p style="margin: 0 0 10px; font-size: 16px; font-weight: 700; color: #0f172a;">
                Olá, ${primeiroNome}! 👋
              </p>
              
              <p style="margin: 0 0 14px; font-size: 14px; line-height: 21px; color: #475569;">
                Recebemos uma solicitação para redefinir a senha da sua conta na <strong>MontesSquad</strong>.
              </p>

              ${codigo ? `
              <!-- Caixa de Destaque do Código de Confirmação -->
              <div style="background-color: #f8fafc; border: 2px dashed #6366f1; border-radius: 10px; padding: 14px 12px; text-align: center; margin: 16px 0;">
                <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4f46e5; letter-spacing: 1.2px;">
                  Seu Código de Confirmação
                </p>
                <div style="font-family: 'Courier New', Courier, monospace, sans-serif; font-size: 30px; font-weight: 800; letter-spacing: 8px; color: #1e1b4b; padding-left: 8px;">
                  ${codigo}
                </div>
                <p style="margin: 6px 0 0; font-size: 12px; color: #64748b;">
                  Insira este código no site para validar sua identidade e redefinir a senha.
                </p>
              </div>
              ` : ''}

              ${resetUrl ? `
              <p style="margin: 14px 0 10px; font-size: 13px; line-height: 19px; color: #475569; text-align: center;">
                Ou se preferir, clique no botão abaixo para redefinir diretamente:
              </p>

              <!-- Botão de Ação -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 10px 0 16px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 8px; box-shadow: 0 3px 10px 0 rgba(99, 102, 241, 0.35); letter-spacing: 0.2px;">
                      Redefinir Minha Senha →
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Aviso de Expiração -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 8px 12px; border-radius: 6px; margin: 14px 0 12px;">
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #92400e;">
                  ⏳ <strong>Importante:</strong> Este código expira em <strong>15 minutos</strong> por motivos de segurança.
                </p>
              </div>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0 12px;">

              <!-- Aviso de Segurança -->
              <p style="margin: 0; font-size: 11px; line-height: 16px; color: #94a3b8;">
                Se você não solicitou este código, ignore esta mensagem com segurança.
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
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
