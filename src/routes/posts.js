const express = require('express');
const postController = require('../controllers/postController');
const likeController = require('../controllers/LikeController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/', authMiddleware, postController.listPosts);
router.get('/:id/reposts', authMiddleware, postController.listReposts);
router.post('/:id/reposts', authMiddleware, postController.repostPost);
router.delete('/:id/reposts', authMiddleware, postController.undoRepost);
router.post('/:id/report', authMiddleware, postController.reportPost);
router.get('/saved', authMiddleware, postController.listSavedPosts);
router.post('/:id/save', authMiddleware, postController.savePost);
router.delete('/:id/save', authMiddleware, postController.unsavePost);
router.get('/archived', authMiddleware, postController.getArchivedPosts);
router.post('/:id/restore', authMiddleware, postController.restorePost);
router.post('/:id/download', authMiddleware, postController.downloadPostMedia);
router.post('/:id/like', authMiddleware, likeController.createLike);
router.post('/:id/likes', authMiddleware, likeController.createLike);
router.get('/:id', authMiddleware, postController.getPostById);
router.post('/', authMiddleware, postController.createPost);
router.put('/:id', authMiddleware, postController.updatePost);
router.delete('/:id', authMiddleware, postController.deletePost);

module.exports = router;