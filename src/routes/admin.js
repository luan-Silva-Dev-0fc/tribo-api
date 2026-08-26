const express = require('express');
const adminController = require('../controllers/adminController');
const feedbackController = require('../controllers/feedbackController');
const reportController = require('../controllers/reportController');
const { auth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.use(auth);
router.use(requireAdmin);

router.get('/users', adminController.listUsers);
router.patch('/users/:id/badge', adminController.toggleUserBadge);
router.put('/users/:id/status', adminController.changeUserStatus);
router.post('/users/:id/ban', adminController.banUser);
router.delete('/users/:id/ban', adminController.unbanUser);
router.post('/purge-deleted-accounts', adminController.purgeDeletedAccounts);

router.get('/reports', adminController.listReports);
router.get('/reports/:id', reportController.getReportById);
router.put('/reports/:id', reportController.updateReport);
router.delete('/reports/:id', reportController.deleteReport);

router.get('/posts', adminController.listAllPosts);
router.delete('/posts/:id', adminController.deletePost);

router.get('/feedbacks', adminController.listFeedbacks);
router.get('/feedbacks/:id', feedbackController.getFeedbackById);
router.put('/feedbacks/:id', feedbackController.updateFeedbackStatus);

router.get('/settings', adminController.getAppSettings);
router.put('/settings', adminController.updateAppSettings);
router.get('/platform-status', adminController.getPlatformStatus);
router.put('/platform-status', adminController.updatePlatformStatus);
router.patch('/platform-status', adminController.updatePlatformStatus);

module.exports = router;