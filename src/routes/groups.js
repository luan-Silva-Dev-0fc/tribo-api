const express = require('express');
const router = express.Router();
const GroupController = require('../controllers/GroupController');
const { auth } = require('../middlewares/auth');

router.use(auth);

router.post('/', GroupController.createGroup);
router.get('/', GroupController.listMyGroups);
router.get('/:id', GroupController.getGroupDetails);
router.put('/:id', GroupController.updateGroup);
router.delete('/:id', GroupController.deleteGroup);

router.post('/:id/add-member', GroupController.addMember);
router.get('/:id/members', GroupController.listMembers);
router.delete('/:id/members/:userId', GroupController.removeMember);
router.post('/:id/ban/:userId', GroupController.banMember);
router.post('/:id/unban/:userId', GroupController.unbanMember);
router.delete('/:id/ban/:userId', GroupController.unbanMember);
router.get('/:id/banned', GroupController.listBannedMembers);
router.post('/:id/leave', GroupController.leaveGroup);
router.post('/:id/report', GroupController.reportGroup);
router.post('/:id/mute', GroupController.toggleMuteGroup);
router.put('/:id/mute', GroupController.toggleMuteGroup);
router.get('/:id/notification-settings', GroupController.getNotificationSettings);

router.get('/:id/feed', GroupController.getFeed);
router.post('/:id/feed', GroupController.createFeedPost);
router.delete('/:id/feed/:postId', GroupController.deleteFeedPost);
router.post('/:id/feed/:postId/download', GroupController.downloadGroupPostMedia);

router.post('/:id/feed/:postId/like', GroupController.likePost);
router.delete('/:id/feed/:postId/like', GroupController.unlikePost);
router.post('/:id/feed/:postId/save', GroupController.savePost);
router.delete('/:id/feed/:postId/save', GroupController.unsavePost);
router.get('/:id/feed/:postId/comments', GroupController.getComments);
router.post('/:id/feed/:postId/comments', GroupController.addComment);
router.delete('/:id/feed/:postId/comments/:commentId', GroupController.deleteComment);
router.delete('/:id/comments/:commentId', GroupController.deleteComment);

router.get('/:id/chat', GroupController.getChat);
router.get('/:id/messages', GroupController.getChat);
router.post('/:id/chat', GroupController.createChatMessage);
router.post('/:id/messages', GroupController.createChatMessage);
router.delete('/:id/chat/:messageId', GroupController.deleteChatMessage);
router.put('/:id/chat/:messageId/view', GroupController.markGroupMediaAsViewed);

router.get('/:id/trends', GroupController.getTrends);

module.exports = router;