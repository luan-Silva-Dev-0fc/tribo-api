const bcrypt = require("bcrypt");
const {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  findUserByIdentifier,
  updateUserByEmail
} = require("../models/authModel");
const { signToken } = require("../services/jwt");
const { logger } = require("../utils/logger");
const { uploadToR2 } = require("../services/cloudflare");
const { sendVerificationEmail } = require("../services/resendService");

function publicUser(user) {
  if (!user) return null;
  const { password, email_verification_code, ...safeUser } = user;
  const bio = safeUser.bio && String(safeUser.bio).trim() !== "" ? String(safeUser.bio).trim() : null;
  return {
    ...safeUser,
    bio,
    is_private: Boolean(safeUser.is_private),
    email_verified: Boolean(safeUser.email_verified || safeUser.verified),
    badge_type: safeUser.badge_type || (safeUser.verified || safeUser.email_verified ? 'BLUE' : 'NONE')
  };
}

function normalizeUsername(value) {
  return String(value || "").
  normalize("NFD").
  replace(/[\u0300-\u036f]/g, "").
  toLowerCase().
  replace(/[^a-z0-9_]+/g, "_").
  replace(/^_+|_+$/g, "").
  slice(0, 24);
}

async function generateAvailableUsername(seed) {
  const base = normalizeUsername(seed) || "usuario";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate =
    attempt === 0 ? base : `${base.slice(0, 20)}_${attempt + 1}`;
    if (!(await findUserByUsername(candidate))) return candidate;
  }
  return `${base.slice(0, 14)}_${Date.now().toString(36)}`;
}

async function register(req, res, next) {
  try {
    const { name, lastName, email, password, username, bio } = req.body;
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({ message: "E-mail já cadastrado" });
    }

    let avatarUrl = null;
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/"))
      return res.
      status(400).
      json({ message: "A foto de perfil deve ser uma imagem" });
      const uploaded = await uploadToR2({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        folder: "profiles"
      });
      avatarUrl = uploaded.url;
    }
    const finalUsername = await generateAvailableUsername(
      username || `${name}_${lastName || ""}`
    );
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const user = await createUser({
      name: `${name} ${lastName || ""}`.trim(),
      first_name: name,
      last_name: lastName || null,
      username: finalUsername,
      email,
      password: hashedPassword,
      avatar_url: avatarUrl,
      bio: bio || null,
      email_verified: false,
      email_verification_code: verificationCode,
      email_verification_expires_at: expiresAt,
      badge_type: 'NONE'
    });

    sendVerificationEmail(email, verificationCode, name).catch((err) => {
      logger.error('Erro assíncrono ao enviar e-mail de verificação:', err);
    });

    const token = signToken({ sub: user.id, email: user.email });

    logger.info("Usuário registrado", { email });
    return res.status(201).json({
      message: "Cadastro realizado com sucesso! Enviamos um código de verificação para o seu e-mail.",
      user: publicUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();

    if (!email || !code) {
      return res.status(400).json({ message: "E-mail e código de verificação são obrigatórios" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (user.email_verified || user.badge_type === 'BLUE' || user.badge_type === 'GOLD') {
      return res.status(200).json({
        message: "E-mail já verificado anteriormente",
        user: publicUser(user)
      });
    }

    if (!user.email_verification_code || String(user.email_verification_code).trim() !== code) {
      return res.status(400).json({ message: "Código de verificação incorreto ou inválido" });
    }

    if (user.email_verification_expires_at && new Date() > new Date(user.email_verification_expires_at)) {
      return res.status(400).json({ message: "Código de verificação expirado. Solicite um novo código." });
    }

    const updated = await updateUserByEmail(email, {
      email_verified: true,
      verified: true,
      badge_type: 'BLUE',
      email_verification_code: null,
      email_verification_expires_at: null
    });

    logger.info("E-mail verificado e Selo Azul ativado", { email });
    return res.status(200).json({
      message: "E-mail validado com sucesso! Selo azul ativado no seu perfil.",
      user: publicUser(updated)
    });
  } catch (error) {
    next(error);
  }
}

async function resendVerificationCode(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "E-mail é obrigatório" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (user.email_verified || user.badge_type === 'BLUE' || user.badge_type === 'GOLD') {
      return res.status(400).json({ message: "Este e-mail já foi verificado" });
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await updateUserByEmail(email, {
      email_verification_code: verificationCode,
      email_verification_expires_at: expiresAt
    });

    await sendVerificationEmail(email, verificationCode, user.first_name || user.name);

    logger.info("Código de verificação reenviado", { email });
    return res.status(200).json({ message: "Codigo reenviado com sucesso" });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, username, identifier, password } = req.body;
    const loginIdentifier = email || username || identifier;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: "E-mail/usuário e senha são obrigatórios" });
    }

    const user = await findUserByIdentifier(loginIdentifier);

    if (!user || user.status === "BANNED" || user.is_deleted) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const isPasswordValid = await bcrypt.compare(String(password).trim(), user.password || "");

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    if (user.status === "PENDING_DELETION") {
      const { sql } = require("../config/database");
      await sql`
        UPDATE users
        SET
          status = 'ACTIVE',
          deletion_scheduled_at = NULL,
          deletion_effective_at = NULL,
          updated_at = NOW()
        WHERE id = ${user.id};
      `;
      user.status = "ACTIVE";
      user.deletion_scheduled_at = null;
      user.deletion_effective_at = null;
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    logger.info("Usuário autenticado", { email: user.email, role: user.role });
    return res.status(200).json({ user: publicUser(user), token });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await findUserById(req.user.sub);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, me, verifyEmail, resendVerificationCode, publicUser };