const reportModel = require("../models/reportModel");

function notFound(res) {
  return res.status(404).json({ message: "Denúncia não encontrada" });
}

function forbidden(res, message = "Sem permissão para esta operação") {
  return res.status(403).json({ message });
}

async function listReports(req, res, next) {
  try {
    if (req.user.role !== "ADMIN") {
      return forbidden(res, "Apenas administradores podem visualizar a lista de denúncias");
    }
    const reports = await reportModel.getAllDetailedReports();
    return res.status(200).json(reports);
  } catch (error) {
    next(error);
  }
}

async function getReportById(req, res, next) {
  try {
    const item = await reportModel.getReportById(req.params.id);
    if (!item) return notFound(res);
    if (item.reporter_id !== req.user.sub && req.user.role !== "ADMIN") {
      return forbidden(res);
    }
    return res.status(200).json(item);
  } catch (error) {
    next(error);
  }
}

async function createReport(req, res, next) {
  try {
    const {
      reason,
      targetType,
      targetId,
      target_type,
      target_id,
      postId,
      post_id,
      userId,
      user_id,
      reported_user_id
    } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "O motivo da denúncia é obrigatório" });
    }

    const rawType = targetType || target_type || (postId || post_id ? "POST" : userId || user_id || reported_user_id ? "USER" : null);
    const type = rawType ? String(rawType).toUpperCase() : "POST";
    const id = targetId || target_id || postId || post_id || userId || user_id || reported_user_id;

    if (!id) {
      return res.status(400).json({
        message: "O identificador do alvo (targetId) é obrigatório"
      });
    }

    const payload = {
      reason: String(reason).trim(),
      reporter_id: req.user.sub,
      status: "pending"
    };

    if (type === "POST") {
      payload.post_id = id;
    } else if (type === "USER") {
      payload.reported_user_id = id;
    } else if (type === "COMMENT") {
      payload.reason = `[DENÚNCIA COMENTÁRIO: ${id}] ${payload.reason}`;
    } else {
      payload.reason = `[DENÚNCIA ${type}: ${id}] ${payload.reason}`;
    }

    const report = await reportModel.createReport(payload);
    return res.status(201).json({
      message: "Denúncia registrada com sucesso",
      report
    });
  } catch (error) {
    next(error);
  }
}

async function updateReport(req, res, next) {
  try {
    const item = await reportModel.getReportById(req.params.id);
    if (!item) return notFound(res);
    if (item.reporter_id !== req.user.sub && req.user.role !== "ADMIN") {
      return forbidden(res);
    }

    const payload = {};
    if (req.body.reason) payload.reason = req.body.reason;
    if (req.body.status && req.user.role === "ADMIN") payload.status = req.body.status;

    const updated = await reportModel.updateReport(req.params.id, payload);
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

async function deleteReport(req, res, next) {
  try {
    const item = await reportModel.getReportById(req.params.id);
    if (!item) return notFound(res);
    if (item.reporter_id !== req.user.sub && req.user.role !== "ADMIN") {
      return forbidden(res);
    }
    await reportModel.deleteReport(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport
};