const express = require('express');
const callController = require('../controllers/callController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/', authMiddleware, callController.listCalls);
router.get('/:id', authMiddleware, callController.getCallById);
router.post('/', authMiddleware, callController.startCall);
router.put('/:id', authMiddleware, callController.updateCall);
router.put('/:id/end', authMiddleware, callController.endCall);
router.delete('/:id', authMiddleware, callController.deleteCall);

module.exports = router;