const express = require('express');
const userController = require('../controllers/userController');
const followController = require('../controllers/followController');
const blockController = require('../controllers/blockController');
const authMiddleware = require('../middlewares/auth');
const { optionalAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/settings', authMiddleware, userController.getSettings);
router.patch('/settings', authMiddleware, userController.updateSettings);
router.put('/settings', authMiddleware, userController.updateSettings);
router.patch('/privacy', authMiddleware, userController.updatePrivacy);
router.get('/follow-requests', authMiddleware, followController.listFollowRequests);
router.post('/requests/:id/accept', authMiddleware, followController.acceptFollowRequest);
router.post('/requests/:id/reject', authMiddleware, followController.rejectFollowRequest);

router.post('/push-token', authMiddleware, userController.savePushToken);
router.delete('/push-token', authMiddleware, userController.removePushToken);

router.get('/', authMiddleware, userController.listUsers);
router.get('/unverified', authMiddleware, userController.getUnverifiedProfiles);
router.get('/search', authMiddleware, userController.searchUsers);
router.get('/suggestions', authMiddleware, userController.suggestUsers);
router.get('/username/:username/availability', userController.checkUsername);
router.get('/blocks', authMiddleware, blockController.listBlocks);
router.post('/:userId/block', authMiddleware, blockController.blockUser);
router.delete('/:userId/block', authMiddleware, blockController.unblockUser);

router.post('/:id/follow', authMiddleware, followController.createFollow);
router.delete('/:id/follow', authMiddleware, followController.unfollowUser);

router.get('/:id/followers', optionalAuth, followController.listFollowers);
router.get('/:id/following', optionalAuth, followController.listFollowing);
router.get('/:id/posts', optionalAuth, userController.getUserPosts);

router.put('/:id/status', authMiddleware, userController.changeUserStatus);
router.post('/:id/ban', authMiddleware, userController.banUser);
router.delete('/:id/ban', authMiddleware, userController.unbanUser);

router.get('/export-data', authMiddleware, userController.exportUserData);
router.get('/download-data', authMiddleware, userController.exportUserData);
router.get('/deletion-status', authMiddleware, userController.getDeletionStatus);
router.post('/request-deletion', authMiddleware, userController.requestAccountDeletion);
router.post('/cancel-deletion', authMiddleware, userController.cancelAccountDeletion);

router.delete('/me', authMiddleware, userController.deleteUser);
router.get('/:id', optionalAuth, userController.getUserById);
router.put('/:id', authMiddleware, userController.updateUser);
router.patch('/:id', authMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, userController.deleteUser);

module.exports = router;