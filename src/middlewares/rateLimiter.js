const rateLimit = require('express-rate-limit');

const ipKeyGenerator = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

// Rate limiter geral para a API (proteção anti-DDoS e flood)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 600, // Limite de 600 requisições por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: ipKeyGenerator,
  message: {
    message: 'Muitas requisições originadas deste IP. Por favor, aguarde um momento antes de tentar novamente.',
    status: 429
  }
});

// Rate limiter para autenticação (proteção contra força bruta em senhas e e-mails)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 60, // Até 60 tentativas a cada 15 minutos
  skipSuccessfulRequests: true, // Login e verificações bem-sucedidas NÃO contam no limite!
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: ipKeyGenerator,
  message: {
    message: 'Muitas tentativas inválidas de autenticação. Por favor, aguarde alguns minutos.',
    status: 429
  }
});

// Rate limiter para uploads de arquivos (proteção de banda, custos e storage)
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 40, // Máximo de 40 uploads por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: ipKeyGenerator,
  message: {
    message: 'Limite de uploads por minuto atingido. Por favor, aguarde alguns segundos.',
    status: 429
  }
});

// Rate limiter para criação de postagens e comentários (anti-spam)
const creationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // Máximo de 30 criações por minuto
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: ipKeyGenerator,
  message: {
    message: 'Você está publicando rápido demais. Por favor, aguarde um instante.',
    status: 429
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  creationLimiter
};
