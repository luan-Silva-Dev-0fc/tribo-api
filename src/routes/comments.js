const express = require('express');
const commentController = require('../controllers/CommentController');
const likeController = require('../controllers/LikeController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/', authMiddleware, commentController.listComments);
router.get('/:id', authMiddleware, commentController.getCommentById);
router.post('/:id/like', authMiddleware, likeController.createLike);
router.post('/:id/likes', authMiddleware, likeController.createLike);
router.post('/', authMiddleware, commentController.createComment);
router.put('/:id', authMiddleware, commentController.updateComment);
router.delete('/:id', authMiddleware, commentController.deleteComment);

module.exports = router;