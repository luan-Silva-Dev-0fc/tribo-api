const { sql } = require('../config/database');
const { verifyToken } = require('../services/jwt');
const { findUserById } = require('../models/authModel');
const { logger } = require('../utils/logger');

let cachedStatus = {
  platform_status: 'ACTIVE',
  suspension_reason: '',
  suspended_at: null,
  lastChecked: 0
};

const CACHE_TTL_MS = 3000;

async function getCachedPlatformStatus() {
  const now = Date.now();
  if (now - cachedStatus.lastChecked < CACHE_TTL_MS) {
    return cachedStatus;
  }

  try {
    const [row] = await sql`
      SELECT platform_status, suspension_reason, suspended_at 
      FROM app_settings 
      WHERE id = 1 
      LIMIT 1;
    `;
    if (row) {
      cachedStatus = {
        platform_status: row.platform_status || 'ACTIVE',
        suspension_reason: row.suspension_reason || '',
        suspended_at: row.suspended_at || null,
        lastChecked: now
      };
    }
  } catch (e) {}

  return cachedStatus;
}

function invalidatePlatformStatusCache() {
  cachedStatus.lastChecked = 0;
}

async function platformStatusMiddleware(req, res, next) {
  try {
    const path = req.path || '';
    const originalUrl = req.originalUrl || '';

    // Rotas sempre liberadas: saúde, configurações do app, login/autenticação e painel admin
    const isAllowedRoute =
      path === '/health' ||
      originalUrl === '/health' ||
      path.startsWith('/app') ||
      originalUrl.includes('/app') ||
      path.startsWith('/admin') ||
      originalUrl.includes('/admin') ||
      path.startsWith('/auth') ||
      originalUrl.includes('/auth') ||
      path.startsWith('/login') ||
      originalUrl.includes('/login') ||
      path.startsWith('/register') ||
      originalUrl.includes('/register') ||
      path.includes('google') ||
      originalUrl.includes('google');

    if (isAllowedRoute) {
      return next();
    }

    const { platform_status, suspension_reason, suspended_at } = await getCachedPlatformStatus();

    if (!platform_status || platform_status === 'ACTIVE') {
      return next();
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      try {
        const payload = verifyToken(token);
        if (payload?.sub) {
          const user = await findUserById(payload.sub);
          if (
            user &&
            user.email?.trim().toLowerCase() === 'luansilva@gmail.com'
          ) {
            req.user = {
              sub: user.id,
              id: user.id,
              email: user.email,
              name: user.name,
              username: user.username,
              avatar_url: user.avatar_url,
              role: user.role,
              status: user.status
            };
            return next();
          }
        }
      } catch (err) {}
    }

    const isMaintenance = platform_status === 'MAINTENANCE';
    const defaultMsg = isMaintenance
      ? 'A plataforma Tribo está temporariamente em manutenção para melhorias no sistema.'
      : 'A plataforma Tribo está temporariamente suspensa por determinação de ordem legal.';

    const message = suspension_reason && suspension_reason.trim()
      ? suspension_reason.trim()
      : defaultMsg;

    logger.warn(`[PlatformSuspension] Acesso bloqueado para rota ${originalUrl} (Status: ${platform_status})`);

    return res.status(503).json({
      error: 'PLATFORM_SUSPENDED',
      code: 'PLATFORM_SUSPENDED',
      status: platform_status,
      platform_status: platform_status,
      message,
      reason: suspension_reason || '',
      suspended_at: suspended_at || new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erro no platformStatusMiddleware:', error.message);
    next();
  }
}

module.exports = {
  platformStatusMiddleware,
  getCachedPlatformStatus,
  invalidatePlatformStatusCache
};
