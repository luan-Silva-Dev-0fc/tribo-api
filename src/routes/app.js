const express = require('express');
const appController = require('../controllers/appController');

const router = express.Router();

router.get('/version', appController.getAppVersion);
router.get('/settings', appController.getAppSettings);

module.exports = router;