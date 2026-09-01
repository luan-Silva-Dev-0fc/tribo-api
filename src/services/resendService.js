const { Resend } = require('resend');
const env = require('../config/env');
const { logger } = require('../utils/logger');

const BLUE_BADGE_CDN_URL = "https://pub-34192334d7d14328ace69168b62cc510.r2.dev/selo%20de%20verificacao/selo%20azul.png";
let resendClient;

function getResendClient() {
  if (!env.RESEND_API_KEY) {
    const error = new Error('RESEND_API_KEY não configurada');
    error.statusCode = 503;
    error.code = 'RESEND_NOT_CONFIGURED';
    throw error;
  }

  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function createDeliveryError(error) {
  const deliveryError = new Error('Não foi possível enviar o código de verificação. Tente novamente.');
  deliveryError.statusCode = error.statusCode || 502;
  deliveryError.code = error.code || 'RESEND_SEND_FAILED';
  return deliveryError;
}

async function sendVerificationEmail(toEmail, code, recipientName) {
  const appUrl = env.APP_URL.replace(/\/+$/, '');
  const name = escapeHtml(recipientName || 'pessoa');

  try {
    const { data, error } = await getResendClient().emails.send({
      from: env.EMAIL_FROM,
      to: [toEmail],
      subject: 'Bem-vindo a Tribo - Codigo de verificacao de conta',
      text: `Olá, ${recipientName || 'pessoa'}! Seu código de verificação da Tribo é ${code}. Ele expira em 15 minutos. Acesse ${appUrl}.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #2d3748; border-radius: 12px; background-color: #121212; color: #ffffff;">
          <h1 style="color: #6366f1; text-align: center; margin-bottom: 24px; letter-spacing: 2px;">TRIBO</h1>

          <h2 style="font-size: 20px; color: #ffffff; margin-bottom: 12px;">Olá, ${name}!</h2>
          <p style="font-size: 14px; color: #cbd5e1; line-height: 1.5; margin-bottom: 24px;">
            Estamos felizes em ter voce conosco. Para concluir o seu cadastro e confirmar a sua conta, utilize o codigo de seguranca abaixo:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background-color: #1e293b; color: #818cf8; padding: 14px 28px; border-radius: 8px; border: 1px solid #334155; display: inline-block;">
              ${code}
            </span>
          </div>

          <div style="background-color: #1e1b4b; border-left: 4px solid #6366f1; padding: 14px; border-radius: 6px; margin-top: 24px; display: flex; align-items: center;">
            <img src="${BLUE_BADGE_CDN_URL}" alt="Selo de Verificacao Azul" width="20" height="20" style="vertical-align: middle; margin-right: 8px;" />
            <span style="font-size: 13px; color: #c7d2fe; vertical-align: middle;">
              <strong>Selo de Verificacao:</strong> Ao digitar este codigo no aplicativo, sua conta sera confirmada e voce recebera o Selo Azul no seu perfil.
            </span>
          </div>

          <hr style="border: none; border-top: 1px solid #2d3748; margin: 28px 0 16px 0;" />
          <p style="font-size: 12px; text-align: center; margin: 0 0 16px 0;">
            <a href="${escapeHtml(appUrl)}" style="color: #818cf8;">Abrir a Tribo</a>
          </p>
          <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
            Se voce nao solicitou este cadastro, por favor ignore esta mensagem.
          </p>
        </div>
      `
    });

    if (error) {
      const resendError = new Error(error.message || 'Resend recusou o envio do e-mail');
      resendError.code = error.name || 'RESEND_SEND_FAILED';
      throw resendError;
    }

    logger.info('E-mail de verificação enviado pelo Resend', { email: toEmail, id: data?.id });
    return { id: data?.id };
  } catch (err) {
    logger.error('Falha ao enviar e-mail de verificação pelo Resend', {
      email: toEmail,
      code: err.code,
      message: err.message
    });
    throw createDeliveryError(err);
  }
}

module.exports = { sendVerificationEmail };
