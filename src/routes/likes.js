const express = require('express');
const likeController = require('../controllers/likeController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/', authMiddleware, likeController.listLikes);
router.get('/:id', authMiddleware, likeController.getLikeById);
router.post('/', authMiddleware, likeController.createLike);
router.put('/:id', authMiddleware, likeController.updateLike);
router.delete('/:id', authMiddleware, likeController.deleteLike);

module.exports = router;