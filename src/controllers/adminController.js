const userModel = require('../models/userModel');
const reportModel = require('../models/reportModel');
const feedbackModel = require('../models/feedbackModel');
const { findUserById } = require('../models/authModel');
const { logger } = require('../utils/logger');
const postModel = require("../models/postModel");
const { invalidateAppSettingsCache } = require('./appController');

async function listUsers(req, res, next) {
  try {
    const users = await userModel.getAdminUsersList();
    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

async function listReports(req, res, next) {
  try {
    const reports = await reportModel.getAllDetailedReports();
    return res.status(200).json(reports);
  } catch (error) {
    next(error);
  }
}

async function listFeedbacks(req, res, next) {
  try {
    const feedbacks = await feedbackModel.getAllFeedbacks();
    return res.status(200).json(feedbacks);
  } catch (error) {
    next(error);
  }
}

async function toggleUserBadge(req, res, next) {
  try {
    const { id } = req.params;
    const { enableGoldBadge, badgeType } = req.body;

    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    let targetBadge = "NONE";

    if (badgeType !== undefined && badgeType !== null) {
      const normalized = String(badgeType).trim().toUpperCase();
      if (normalized === "GOLD") targetBadge = "GOLD";else
      if (normalized === "BLUE") targetBadge = "BLUE";else
      targetBadge = "NONE";
    } else if (enableGoldBadge === true || enableGoldBadge === "true") {
      targetBadge = "GOLD";
    } else if (enableGoldBadge === false || enableGoldBadge === "false") {
      targetBadge = Boolean(user.email_verified || user.verified) ? "BLUE" : "NONE";
    }

    const updatedUser = await userModel.updateUserBadge(id, targetBadge);
    logger.info(`[Admin] Selo alterado para ${targetBadge} no usuário ${user.email} (${user.id}) por ${req.user?.email || 'admin'}`);

    const message = targetBadge === "GOLD" ?
    "Selo Dourado (VIP) concedido com sucesso" :
    targetBadge === "BLUE" ?
    "Selo Azul (Verificado) concedido/restaurado com sucesso" :
    "Selo removido com sucesso (Conta Padrão)";

    return res.status(200).json({
      message,
      user: updatedUser,
      badge: targetBadge
    });
  } catch (error) {
    next(error);
  }
}

async function banUser(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const updated = await userModel.updateUserStatus(id, {
      status: "BANNED",
      banned_at: new Date().toISOString(),
      ban_reason: reason || "Violação recorrente das diretrizes da comunidade"
    });

    logger.warn(`[Admin] Usuário ${id} banido por ${req.user.email}. Motivo: ${reason || 'N/A'}`);
    return res.status(200).json({
      message: "Usuário banido com sucesso",
      user: updated
    });
  } catch (error) {
    next(error);
  }
}

async function unbanUser(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await userModel.updateUserStatus(id, {
      status: "ACTIVE",
      banned_at: null,
      ban_reason: null
    });

    logger.info(`[Admin] Usuário ${id} reativado por ${req.user.email}`);
    return res.status(200).json({
      message: "Usuário desbanido e reativado com sucesso",
      user: updated
    });
  } catch (error) {
    next(error);
  }
}

async function changeUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const valid = ["ACTIVE", "SUSPENDED", "BANNED"];

    if (!valid.includes(status)) {
      return res.status(400).json({ message: "Status inválido. Use ACTIVE, SUSPENDED ou BANNED" });
    }

    const payload = { status };
    if (status === "BANNED") {
      payload.banned_at = new Date().toISOString();
      payload.ban_reason = reason || "Violação das regras da comunidade";
    } else {
      payload.banned_at = null;
      payload.ban_reason = null;
    }

    const updated = await userModel.updateUserStatus(id, payload);
    return res.status(200).json({
      message: `Status do usuário atualizado para ${status}`,
      user: updated
    });
  } catch (error) {
    next(error);
  }
}

const { runAccountPurge } = require('../services/accountPurgeService');

async function purgeDeletedAccounts(req, res, next) {
  try {
    const result = await runAccountPurge();
    return res.status(200).json({
      success: true,
      message: `${result.purgedCount} conta(s) com prazo de 15 dias expirado foram purgadas definitivamente.`,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

async function listAllPosts(req, res, next) {
  try {
    const posts = await postModel.getAllPostsForAdmin();
    return res.status(200).json(posts);
  } catch (error) {
    next(error);
  }
}

async function deletePost(req, res, next) {
  try {
    const { id } = req.params;
    await postModel.deletePost(id);
    logger.info(`[Admin] Postagem ${id} excluída por ${req.user.sub}`);
    return res.status(200).json({ message: "Postagem excluída com sucesso" });
  } catch (error) {
    next(error);
  }
}

const { invalidatePlatformStatusCache } = require('../middlewares/platformStatusMiddleware');

async function getAppSettings(req, res, next) {
  try {
    const { supabase, sql } = require('../config/database');
    let settings = null;
    try {
      const [row] = await sql`SELECT * FROM app_settings WHERE id = 1 LIMIT 1;`;
      if (row) settings = row;
    } catch {}

    if (!settings && supabase) {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
      if (data) settings = data;
    }

    const payload = {
      id: 1,
      latest_version: settings?.latest_version || "1.2.0",
      download_url: settings?.download_url || "https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/releases/tribo-latest.apk",
      force_update: Boolean(settings?.force_update),
      release_notes: settings?.release_notes || "",
      global_feed_enabled: Boolean(settings?.global_feed_enabled || settings?.is_global_feed_enabled),
      is_global_feed_enabled: Boolean(settings?.global_feed_enabled || settings?.is_global_feed_enabled),
      enable_tribo_feed: Boolean(settings?.enable_tribo_feed),
      enable_tribo_trends: Boolean(settings?.enable_tribo_trends),
      platform_status: settings?.platform_status || "ACTIVE",
      suspension_reason: settings?.suspension_reason || "",
      suspended_at: settings?.suspended_at || null,
      suspended_by: settings?.suspended_by || null
    };

    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
}

async function updateAppSettings(req, res, next) {
  try {
    const { sql } = require('../config/database');
    const body = req.body || {};

    const [current] = await sql`SELECT * FROM app_settings WHERE id = 1 LIMIT 1;`;

    const latest_version = body.latest_version !== undefined ? body.latest_version : current?.latest_version || '1.2.0';
    const download_url = body.download_url !== undefined ? body.download_url : current?.download_url || '';
    const force_update = body.force_update !== undefined ? Boolean(body.force_update) : Boolean(current?.force_update);
    const release_notes = body.release_notes !== undefined ? body.release_notes : current?.release_notes || '';

    const global_feed = body.is_global_feed_enabled !== undefined ?
      Boolean(body.is_global_feed_enabled) :
      body.global_feed_enabled !== undefined ?
      Boolean(body.global_feed_enabled) :
      Boolean(current?.global_feed_enabled || current?.is_global_feed_enabled);

    const enable_tribo_feed = body.enable_tribo_feed !== undefined ?
      Boolean(body.enable_tribo_feed) :
      Boolean(current?.enable_tribo_feed);

    const enable_tribo_trends = body.enable_tribo_trends !== undefined ?
      Boolean(body.enable_tribo_trends) :
      Boolean(current?.enable_tribo_trends);

    let platform_status = current?.platform_status || 'ACTIVE';
    if (body.platform_status !== undefined) {
      const validStatuses = ['ACTIVE', 'MAINTENANCE', 'LEGAL_ORDER'];
      if (validStatuses.includes(String(body.platform_status).toUpperCase())) {
        platform_status = String(body.platform_status).toUpperCase();
      }
    }

    const suspension_reason = body.suspension_reason !== undefined ?
      String(body.suspension_reason).trim() :
      current?.suspension_reason || '';

    let suspended_at = current?.suspended_at;
    let suspended_by = current?.suspended_by;

    if (platform_status !== 'ACTIVE' && current?.platform_status === 'ACTIVE') {
      suspended_at = new Date().toISOString();
      suspended_by = req.user?.email || req.user?.username || 'admin';
    } else if (platform_status === 'ACTIVE') {
      suspended_at = null;
      suspended_by = null;
    }

    const [saved] = await sql`
      INSERT INTO app_settings (
        id, latest_version, download_url, force_update, release_notes,
        global_feed_enabled, is_global_feed_enabled, enable_tribo_feed, enable_tribo_trends,
        platform_status, suspension_reason, suspended_at, suspended_by, updated_at
      )
      VALUES (
        1, ${latest_version}, ${download_url}, ${force_update}, ${release_notes},
        ${global_feed}, ${global_feed}, ${enable_tribo_feed}, ${enable_tribo_trends},
        ${platform_status}, ${suspension_reason}, ${suspended_at}, ${suspended_by}, NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        latest_version = EXCLUDED.latest_version,
        download_url = EXCLUDED.download_url,
        force_update = EXCLUDED.force_update,
        release_notes = EXCLUDED.release_notes,
        global_feed_enabled = EXCLUDED.global_feed_enabled,
        is_global_feed_enabled = EXCLUDED.is_global_feed_enabled,
        enable_tribo_feed = EXCLUDED.enable_tribo_feed,
        enable_tribo_trends = EXCLUDED.enable_tribo_trends,
        platform_status = EXCLUDED.platform_status,
        suspension_reason = EXCLUDED.suspension_reason,
        suspended_at = EXCLUDED.suspended_at,
        suspended_by = EXCLUDED.suspended_by,
        updated_at = NOW()
      RETURNING *;
    `;

    invalidatePlatformStatusCache();
    logger.info(`[Admin] Configurações e status da plataforma atualizados por ${req.user?.email || 'admin'}: ${platform_status}`);

    try {
      const io = req.app?.get('io') || global.io;
      if (io) {
        io.emit('platform-status-changed', {
          platform_status: saved.platform_status || 'ACTIVE',
          platformStatus: saved.platform_status || 'ACTIVE',
          suspension_reason: saved.suspension_reason || '',
          suspensionReason: saved.suspension_reason || '',
          suspended_at: saved.suspended_at,
          suspendedAt: saved.suspended_at
        });
      }
    } catch (e) {}

    invalidatePlatformStatusCache();
    invalidateAppSettingsCache();
    return res.status(200).json({
      message: "Configurações atualizadas com sucesso",
      settings: saved,
      is_global_feed_enabled: Boolean(saved.global_feed_enabled || saved.is_global_feed_enabled),
      enable_tribo_feed: Boolean(saved.enable_tribo_feed),
      enable_tribo_trends: Boolean(saved.enable_tribo_trends),
      platform_status: saved.platform_status || 'ACTIVE',
      suspension_reason: saved.suspension_reason || '',
      suspended_at: saved.suspended_at,
      suspended_by: saved.suspended_by
    });
  } catch (error) {
    next(error);
  }
}

async function getPlatformStatus(req, res, next) {
  try {
    const { sql } = require('../config/database');
    const [row] = await sql`
      SELECT platform_status, suspension_reason, suspended_at, suspended_by 
      FROM app_settings 
      WHERE id = 1 
      LIMIT 1;
    `;

    return res.status(200).json({
      platform_status: row?.platform_status || 'ACTIVE',
      suspension_reason: row?.suspension_reason || '',
      suspended_at: row?.suspended_at || null,
      suspended_by: row?.suspended_by || null
    });
  } catch (error) {
    next(error);
  }
}

async function updatePlatformStatus(req, res, next) {
  try {
    const { sql } = require('../config/database');
    const { status, reason } = req.body || {};

    const validStatuses = ['ACTIVE', 'MAINTENANCE', 'LEGAL_ORDER'];
    const normalizedStatus = String(status || '').toUpperCase();

    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        message: "Status inválido. Use ACTIVE, MAINTENANCE ou LEGAL_ORDER"
      });
    }

    const suspension_reason = reason !== undefined ? String(reason).trim() : '';
    const isSuspended = normalizedStatus !== 'ACTIVE';
    const suspended_at = isSuspended ? new Date().toISOString() : null;
    const suspended_by = isSuspended ? (req.user?.email || 'admin') : null;

    const [updated] = await sql`
      UPDATE app_settings 
      SET 
        platform_status = ${normalizedStatus},
        suspension_reason = ${suspension_reason},
        suspended_at = ${suspended_at},
        suspended_by = ${suspended_by},
        updated_at = NOW()
      WHERE id = 1
      RETURNING platform_status, suspension_reason, suspended_at, suspended_by;
    `;

    invalidatePlatformStatusCache();
    invalidateAppSettingsCache();
    logger.warn(`[Admin] Status da plataforma alterado para ${normalizedStatus} por ${req.user?.email || 'admin'}. Motivo: ${suspension_reason}`);

    try {
      const io = req.app?.get('io') || global.io;
      if (io) {
        io.emit('platform-status-changed', {
          platform_status: updated?.platform_status || normalizedStatus,
          platformStatus: updated?.platform_status || normalizedStatus,
          suspension_reason: updated?.suspension_reason || suspension_reason,
          suspensionReason: updated?.suspension_reason || suspension_reason,
          suspended_at: updated?.suspended_at || suspended_at,
          suspendedAt: updated?.suspended_at || suspended_at
        });
      }
    } catch (e) {}

    return res.status(200).json({
      message: `Status da plataforma atualizado para ${normalizedStatus}`,
      platform_status: updated?.platform_status || normalizedStatus,
      suspension_reason: updated?.suspension_reason || '',
      suspended_at: updated?.suspended_at || null,
      suspended_by: updated?.suspended_by || null
    });
  } catch (error) {
    next(error);
  }
}

async function resetUserData(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const updated = await userModel.wipeUserData(id);
    logger.warn(`[Admin] Todos os dados do usuário @${user.username || user.name} (${id}) foram resetados por ${req.user.email}. Motivo: ${reason || 'N/A'}`);
    return res.status(200).json({
      message: `Todos os dados (posts, comentários, curtidas, mensagens, seguidores) de @${user.username || user.name} foram excluídos com sucesso.`,
      user: updated
    });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const user = await userModel.getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    await userModel.deleteUserCompletely(id);
    logger.warn(`[Admin] Conta e todos os dados do usuário @${user.username || user.name} (${id}) foram excluídos definitivamente por ${req.user.email}. Motivo: ${reason || 'N/A'}`);
    return res.status(200).json({
      message: `A conta e todos os dados de @${user.username || user.name} foram excluídos permanentemente.`
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  listReports,
  listFeedbacks,
  listAllPosts,
  deletePost,
  toggleUserBadge,
  banUser,
  unbanUser,
  changeUserStatus,
  purgeDeletedAccounts,
  resetUserData,
  deleteUser,
  getAppSettings,
  updateAppSettings,
  getPlatformStatus,
  updatePlatformStatus
};