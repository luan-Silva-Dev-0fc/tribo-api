const express = require('express');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/', authMiddleware, notificationController.listNotifications);
router.get('/:id', authMiddleware, notificationController.getNotificationById);
router.post('/', authMiddleware, notificationController.createNotification);
router.put('/:id', authMiddleware, notificationController.updateNotification);
router.delete('/:id', authMiddleware, notificationController.deleteNotification);

module.exports = router;