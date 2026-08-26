const notificationModel = require("../models/notificationModel");

function notFound(res) {
  return res.status(404).json({ message: "Notificação não encontrada" });
}
function forbidden(res) {
  return res.status(403).json({ message: "Sem permissão para esta operação" });
}

async function listNotifications(req, res, next) {
  try {
    const notifications = await notificationModel.getNotificationsByUser(
      req.user.sub
    );

    if (notificationModel.markAllAsRead) {
      notificationModel.markAllAsRead(req.user.sub).catch((err) => console.warn("Failed to mark notifications as read", err));
    }
    return res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
}

async function getNotificationById(req, res, next) {
  try {
    const item = await notificationModel.getNotificationById(req.params.id);
    if (!item) return notFound(res);
    if (item.user_id !== req.user.sub) return forbidden(res);
    return res.status(200).json(item);
  } catch (error) {
    next(error);
  }
}

async function createNotification(req, res, next) {
  try {
    const { message } = req.body;
    return res.
    status(201).
    json(
      await notificationModel.createNotification({
        user_id: req.user.sub,
        message
      })
    );
  } catch (error) {
    next(error);
  }
}

async function updateNotification(req, res, next) {
  try {
    const item = await notificationModel.getNotificationById(req.params.id);
    if (!item) return notFound(res);
    if (item.user_id !== req.user.sub) return forbidden(res);
    const updated = await notificationModel.updateNotification(req.params.id, {
      is_read: Boolean(req.body.isRead)
    });
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const item = await notificationModel.getNotificationById(req.params.id);
    if (!item) return notFound(res);
    if (item.user_id !== req.user.sub) return forbidden(res);
    await notificationModel.deleteNotification(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification
};