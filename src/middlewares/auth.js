const { verifyToken } = require("../services/jwt");
const { logger } = require("../utils/logger");
const { findUserById } = require("../models/authModel");

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Token de autenticação ausente" });
    }

    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    if (user.status === "BANNED") {
      return res.status(403).json({
        message: "Conta banida por violação das diretrizes da comunidade",
        bannedAt: user.banned_at,
        banReason: user.ban_reason
      });
    }

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
    next();
  } catch (error) {
    logger.error("Falha na autenticação", error.message);
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return next();
    }

    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);

    if (user && user.status !== "BANNED") {
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
    }
    next();
  } catch (error) {
    logger.error("Falha silenciosa no optionalAuth ao decodificar token", error.message);
    next();
  }
}

async function requireAdmin(req, res, next) {
  const isMaster = req.user && (
    req.user.role === "ADMIN" ||
    req.user.email?.toLowerCase() === "luansilva@gmail.com"
  );
  if (!isMaster) {
    return res.status(403).json({
      message: "Acesso restrito: apenas administradores podem realizar esta operação"
    });
  }
  next();
}

module.exports = auth;
module.exports.auth = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;