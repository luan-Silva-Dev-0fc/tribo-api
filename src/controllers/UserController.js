const userModel = require("../models/userModel");
const { findUserById, findUserByUsername } = require("../models/authModel");
const followModel = require("../models/followModel");
const postModel = require("../models/postModel");

function normalizeUsername(value) {
  return String(value || "").
  normalize("NFD").
  replace(/[\u0300-\u036f]/g, "").
  toLowerCase().
  replace(/[^a-z0-9_]+/g, "_").
  replace(/^_+|_+$/g, "");
}

async function requireAdmin(req, res) {
  const actor = await findUserById(req.user.sub);
  if (!actor || actor.role !== "ADMIN") {
    res.status(403).json({ message: "Apenas administradores podem moderar usuários" });
    return false;
  }
  return true;
}

async function listUsers(req, res, next) {
  try {
    const search = req.query.q || req.query.search || req.query.query || "";
    const users = await userModel.getAllUsers(req.user?.sub, search);
    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

async function searchUsers(req, res, next) {
  try {
    const search = req.query.q || req.query.search || req.query.query || "";
    const users = await userModel.searchUsers(search, req.user?.sub);
    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await userModel.getUserById(req.params.id, req.user?.sub);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    console.log(`[PROFILE GET] User Logado (viewerId): ${req.user?.sub || 'ANÔNIMO'} | Perfil Alvo: ${req.params.id} | isFollowing: ${user.is_following}`);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

async function checkUsername(req, res, next) {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username || username.length < 3 || username.length > 24) {
      return res.status(400).json({ message: "Username deve ter entre 3 e 24 caracteres" });
    }
    const user = await findUserByUsername(username);
    return res.status(200).json({ username, available: !user });
  } catch (error) {
    next(error);
  }
}

async function suggestUsers(req, res, next) {
  try {
    return res.status(200).json(await userModel.getSuggestedUsers(req.user.sub));
  } catch (error) {
    next(error);
  }
}

async function getSettings(req, res, next) {
  try {
    const settings = await userModel.getUserSettings(req.user.sub);
    if (!settings) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    return res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const payload = req.body || {};
    const updated = await userModel.updateUserSettings(req.user.sub, payload);
    if (!updated) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    return res.status(200).json({
      message: "Configurações atualizadas com sucesso",
      settings: updated,
      show_online_status: updated.show_online_status,
      showOnlineStatus: updated.showOnlineStatus,
      read_receipts: updated.read_receipts,
      readReceipts: updated.readReceipts,
      is_private: updated.is_private,
      isPrivate: updated.isPrivate
    });
  } catch (error) {
    next(error);
  }
}

async function updatePrivacy(req, res, next) {
  try {
    if (req.body.is_private === undefined && req.body.private_account === undefined && req.body.isPrivate === undefined) {
      return res.status(400).json({ message: "Campo is_private (boolean) é obrigatório" });
    }

    const isPrivate = Boolean(
      req.body.is_private !== undefined ?
      req.body.is_private :
      req.body.isPrivate !== undefined ?
      req.body.isPrivate :
      req.body.private_account
    );
    const updated = await userModel.updateUserPrivacy(req.user.sub, isPrivate);

    return res.status(200).json({
      message: isPrivate ?
      "Conta configurada como privada. Apenas seguidores aprovados poderão ver suas publicações." :
      "Conta configurada como pública. Qualquer pessoa poderá ver suas publicações.",
      is_private: updated.is_private,
      isPrivate: updated.isPrivate,
      user: updated
    });
  } catch (error) {
    next(error);
  }
}

async function getUserPosts(req, res, next) {
  try {
    const result = await postModel.getPostsByUserId(req.params.id, req.user.sub);
    if (!result) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    if (req.params.id !== req.user.sub) {
      return res.status(403).json({ message: "Sem permissão para esta operação" });
    }
    const {
      name, firstName, lastName, username, bio, avatarUrl, avatar_url, avatar,
      is_private, private_account, isPrivate,
      show_online_status, showOnlineStatus, read_receipts, readReceipts
    } = req.body;
    const resolvedAvatar = avatarUrl || avatar_url || avatar;

    const payload = {};
    if (name !== undefined) payload.name = name;
    if (firstName !== undefined) payload.first_name = firstName;
    if (lastName !== undefined) payload.last_name = lastName;
    if (bio !== undefined) payload.bio = bio ? String(bio).trim() : null;
    if (resolvedAvatar !== undefined) payload.avatar_url = resolvedAvatar;
    if (is_private !== undefined) payload.is_private = Boolean(is_private);
    if (isPrivate !== undefined) payload.is_private = Boolean(isPrivate);
    if (private_account !== undefined) payload.is_private = Boolean(private_account);
    if (show_online_status !== undefined) payload.show_online_status = Boolean(show_online_status);
    if (showOnlineStatus !== undefined) payload.show_online_status = Boolean(showOnlineStatus);
    if (read_receipts !== undefined) payload.read_receipts = Boolean(read_receipts);
    if (readReceipts !== undefined) payload.read_receipts = Boolean(readReceipts);

    if (username !== undefined) {
      const normalized = normalizeUsername(username);
      if (normalized.length < 3 || normalized.length > 24) {
        return res.status(400).json({ message: "Username deve ter entre 3 e 24 caracteres" });
      }
      const existing = await findUserByUsername(normalized);
      if (existing && existing.id !== req.user.sub) {
        return res.status(409).json({ message: "Username indisponível" });
      }
      payload.username = normalized;
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "Nenhum dado válido para atualização" });
    }

    const updated = await userModel.updateUser(req.params.id, payload);
    if (!updated) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

async function unfollowUser(req, res, next) {
  try {
    const follow = await followModel.findFollow(req.user.sub, req.params.id);
    if (!follow) return res.status(404).json({ message: "Você não segue este usuário" });
    await followModel.deleteFollow(follow.id);
    return res.status(200).json({ message: "Deixou de seguir o usuário com sucesso" });
  } catch (error) {
    next(error);
  }
}

async function changeUserStatus(req, res, next) {
  try {
    if (!(await requireAdmin(req, res))) return;
    const status = String(req.body.status || "").toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "BANNED"].includes(status)) {
      return res.status(400).json({ message: "Status inválido" });
    }
    const user = await userModel.updateUserStatus(req.params.id, {
      status,
      banned_at: status === "BANNED" ? new Date().toISOString() : null,
      ban_reason: status === "BANNED" ? req.body.reason || null : null
    });
    return user ? res.status(200).json(user) : res.status(404).json({ message: "Usuário não encontrado" });
  } catch (error) {
    next(error);
  }
}

async function banUser(req, res, next) {
  req.body.status = "BANNED";
  return changeUserStatus(req, res, next);
}

async function unbanUser(req, res, next) {
  req.body.status = "ACTIVE";
  return changeUserStatus(req, res, next);
}

const userExportService = require("../services/userExportService");

async function exportUserData(req, res, next) {
  try {
    const userId = req.user.sub;
    const exportData = await userExportService.generateUserDataExport(userId);
    const filename = `tribo-dados-${exportData.meta.username || "usuario"}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(exportData);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function requestAccountDeletion(req, res, next) {
  try {
    const userId = req.user.sub;
    const { password } = req.body || {};
    const result = await userModel.scheduleAccountDeletion(userId, password);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function cancelAccountDeletion(req, res, next) {
  try {
    const userId = req.user.sub;
    const result = await userModel.cancelAccountDeletion(userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function getDeletionStatus(req, res, next) {
  try {
    const userId = req.user.sub;
    const status = await userModel.getDeletionStatus(userId);
    if (!status) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    return res.status(200).json(status);
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const targetId = req.params.id === "me" || !req.params.id ? req.user.sub : req.params.id;
    const isSelf = targetId === req.user.sub;

    if (!isSelf && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Sem permissão para esta operação" });
    }

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
    const { sql } = require("../config/database");

    if (isSelf) {

      await sql`
        INSERT INTO judicial_logs (user_id, action_type, payload, ip_address)
        VALUES (${targetId}, 'ACCOUNT_DELETION_REQUEST', ${sql.json({ targetId })}, ${ipAddress || null})
      `;

      return requestAccountDeletion(req, res, next);
    } else {

      const user = await userModel.getUserById(targetId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      await sql`
        INSERT INTO judicial_logs (user_id, action_type, payload, ip_address)
        VALUES (${req.user.sub}, 'ADMIN_ACCOUNT_DELETION', ${sql.json({ targetId })}, ${ipAddress || null})
      `;
      await userModel.deleteUser(targetId);
      return res.status(200).json({ success: true, message: "Conta excluída definitivamente pelo administrador." });
    }
  } catch (error) {
    next(error);
  }
}

async function savePushToken(req, res, next) {
  try {
    const token =
    req.body.token ||
    req.body.push_token ||
    req.body.pushToken ||
    req.body.fcmToken ||
    req.body.fcm_token;
    const deviceType =
    req.body.device_type || req.body.deviceType || req.body.platform || "mobile";

    if (!token) {
      return res.status(400).json({ message: "O campo token é obrigatório" });
    }

    const pushTokenModel = require("../models/pushTokenModel");
    const saved = await pushTokenModel.savePushToken({
      userId: req.user.sub,
      token,
      deviceType
    });

    return res.status(200).json({
      message: "Token de notificação registrado com sucesso",
      push_token: saved
    });
  } catch (error) {
    next(error);
  }
}

async function removePushToken(req, res, next) {
  try {
    const token =
    req.body.token ||
    req.body.push_token ||
    req.body.pushToken ||
    req.body.fcmToken ||
    req.body.fcm_token;
    if (!token) {
      return res.status(400).json({ message: "O campo token é obrigatório" });
    }

    const pushTokenModel = require("../models/pushTokenModel");
    await pushTokenModel.removePushToken(req.user.sub, token);

    return res.status(200).json({
      message: "Token de notificação removido com sucesso"
    });
  } catch (error) {
    next(error);
  }
}

async function getUnverifiedProfiles(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await userModel.getUnverifiedUsers(limit, offset);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  searchUsers,
  getUserById,
  checkUsername,
  suggestUsers,
  updateUser,
  updatePrivacy,
  getSettings,
  updateSettings,
  getUserPosts,
  deleteUser,
  exportUserData,
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  unfollowUser,
  changeUserStatus,
  banUser,
  unbanUser,
  savePushToken,
  removePushToken,
  getUnverifiedProfiles
};