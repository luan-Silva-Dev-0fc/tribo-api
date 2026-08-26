const express = require('express');
const messageController = require('../controllers/MessageController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.post('/', authMiddleware, messageController.createMessage);
router.get('/conversations', authMiddleware, messageController.listConversations);

router.put('/read', authMiddleware, messageController.markAsRead);
router.patch('/read', authMiddleware, messageController.markAsRead);
router.put('/:id/read', authMiddleware, messageController.markAsRead);
router.patch('/:id/read', authMiddleware, messageController.markAsRead);
router.put('/:id/view', authMiddleware, messageController.markViewOnceAsViewed);

router.put('/:id', authMiddleware, messageController.editMessage);
router.patch('/:id', authMiddleware, messageController.editMessage);
router.delete('/:id', authMiddleware, messageController.deleteMessage);

router.get('/:userId', authMiddleware, messageController.getChatHistory);

module.exports = router;