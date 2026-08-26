const express = require('express');
const storyController = require('../controllers/storyController');
const authMiddleware = require('../middlewares/auth');
const { uploadFile } = require('../middlewares/upload');

const router = express.Router();

router.post('/', authMiddleware, uploadFile, storyController.createStory);
router.get('/', authMiddleware, storyController.getFeedStories);
router.get('/user/:id', authMiddleware, storyController.getUserStories);
router.get('/:id', authMiddleware, storyController.getStoryById);
router.patch('/:id', authMiddleware, storyController.updateStory);
router.delete('/:id', authMiddleware, storyController.deleteStory);
router.post('/:id/send', authMiddleware, storyController.sendStory);
router.post('/:id/like', authMiddleware, storyController.likeStory);
router.delete('/:id/like', authMiddleware, storyController.unlikeStory);

module.exports = router;