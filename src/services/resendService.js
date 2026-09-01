const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const { logger } = require('../utils/logger');

const BLUE_BADGE_CDN_URL = "https://pub-34192334d7d14328ace69168b62cc510.r2.dev/selo%20de%20verificacao/selo%20azul.png";
let resendClient;
let smtpTransporter;

function getResendClient() {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

function getSmtpTransporter() {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }
  return smtpTransporter;
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

function getSenderAddress() {
  const from = String(env.EMAIL_FROM || 'Tribo <noreply@tribo-brasil.app.br>').replace(/^["']|["']$/g, '').trim();
  return from || 'Tribo <noreply@tribo-brasil.app.br>';
}

function generateEmailTemplate(code, recipientName, appUrl) {
  const name = escapeHtml(recipientName || 'pessoa');
  const cleanAppUrl = escapeHtml(appUrl);

  const text = `Olá, ${recipientName || 'pessoa'}! Seu código de verificação da Tribo é ${code}. Ele expira em 15 minutos. Acesse ${appUrl}.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #2d3748; border-radius: 12px; background-color: #121212; color: #ffffff;">
      <h1 style="color: #6366f1; text-align: center; margin-bottom: 24px; letter-spacing: 2px;">TRIBO</h1>

      <h2 style="font-size: 20px; color: #ffffff; margin-bottom: 12px;">Olá, ${name}!</h2>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.5; margin-bottom: 24px;">
        Estamos felizes em ter você conosco. Para concluir o seu cadastro e confirmar a sua conta, utilize o código de segurança abaixo:
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; background-color: #1e293b; color: #818cf8; padding: 14px 28px; border-radius: 8px; border: 1px solid #334155; display: inline-block;">
          ${code}
        </span>
      </div>

      <div style="background-color: #1e1b4b; border-left: 4px solid #6366f1; padding: 14px; border-radius: 6px; margin-top: 24px; display: flex; align-items: center;">
        <img src="${BLUE_BADGE_CDN_URL}" alt="Selo de Verificação Azul" width="20" height="20" style="vertical-align: middle; margin-right: 8px;" />
        <span style="font-size: 13px; color: #c7d2fe; vertical-align: middle;">
          <strong>Selo de Verificação:</strong> Ao digitar este código no aplicativo, sua conta será confirmada e você receberá o Selo Azul no seu perfil.
        </span>
      </div>

      <hr style="border: none; border-top: 1px solid #2d3748; margin: 28px 0 16px 0;" />
      <p style="font-size: 12px; text-align: center; margin: 0 0 16px 0;">
        <a href="${cleanAppUrl}" style="color: #818cf8; text-decoration: none; font-weight: bold;">Abrir a Tribo</a>
      </p>
      <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
        Se você não solicitou este cadastro, por favor ignore esta mensagem.
      </p>
    </div>
  `;

  return { text, html };
}

async function sendVerificationEmail(toEmail, code, recipientName) {
  const cleanToEmail = String(toEmail || '').trim().toLowerCase();
  if (!cleanToEmail || !cleanToEmail.includes('@')) {
    const error = new Error('Endereço de e-mail inválido');
    error.statusCode = 400;
    throw error;
  }

  const appUrl = (env.APP_URL || 'https://tribo-brasil.app.br').replace(/\/+$/, '');
  const sender = getSenderAddress();
  const subject = 'Bem-vindo à Tribo - Código de verificação de conta';
  const { text, html } = generateEmailTemplate(code, recipientName, appUrl);

  const resend = getResendClient();

  // 1. Tentativa primária: Resend API
  if (resend) {
    try {
      const response = await resend.emails.send({
        from: sender,
        to: [cleanToEmail],
        subject,
        text,
        html
      });

      if (response.error) {
        logger.warn('Resend retornou erro na entrega:', {
          email: cleanToEmail,
          sender,
          error: response.error?.message || response.error,
          name: response.error?.name
        });
        throw new Error(response.error?.message || 'Resend recusou o envio do e-mail');
      }

      logger.info('E-mail de verificação enviado com sucesso pelo Resend', {
        email: cleanToEmail,
        id: response.data?.id
      });
      return { id: response.data?.id, provider: 'resend' };
    } catch (resendErr) {
      logger.warn('Tentativa via Resend não concluída, ativando failover automático via SMTP Gmail...', {
        email: cleanToEmail,
        motivo: resendErr.message
      });
    }
  }

  // 2. Fallback secundário: SMTP (Nodemailer)
  const smtp = getSmtpTransporter();
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from: `Tribo <${env.SMTP_USER}>`,
        to: cleanToEmail,
        subject,
        text,
        html
      });

      logger.info('E-mail de verificação enviado com sucesso via Fallback SMTP', {
        email: cleanToEmail,
        messageId: info.messageId
      });
      return { id: info.messageId, provider: 'smtp' };
    } catch (smtpErr) {
      logger.error('Falha no fallback SMTP ao enviar e-mail de verificação', {
        email: cleanToEmail,
        error: smtpErr.message
      });
      const deliveryError = new Error(`Não foi possível entregar o e-mail de verificação (${smtpErr.message})`);
      deliveryError.statusCode = 502;
      deliveryError.code = 'EMAIL_DELIVERY_FAILED';
      throw deliveryError;
    }
  }

  const notConfiguredError = new Error('Nenhum provedor de e-mail (Resend ou SMTP) configurado ou disponível.');
  notConfiguredError.statusCode = 503;
  notConfiguredError.code = 'EMAIL_SERVICE_UNAVAILABLE';
  throw notConfiguredError;
}

module.exports = { sendVerificationEmail };
