const feedbackModel = require('../models/feedbackModel');
const { logger } = require('../utils/logger');

async function sendFeedback(req, res, next) {
  try {
    const { subject, message } = req.body;
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ message: "O assunto (subject) é obrigatório" });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "A mensagem (message) é obrigatória" });
    }

    const feedback = await feedbackModel.createFeedback({
      userId: req.user.sub,
      subject: String(subject).trim(),
      message: String(message).trim()
    });

    logger.info("Novo feedback enviado por usuário", { userId: req.user.sub, subject });

    return res.status(201).json({
      message: "Feedback enviado com sucesso! Obrigado por nos ajudar a melhorar a Tribo.",
      feedback
    });
  } catch (error) {
    next(error);
  }
}

async function listFeedbacks(req, res, next) {
  try {
    const feedbacks = await feedbackModel.getAllFeedbacks();
    return res.status(200).json(feedbacks);
  } catch (error) {
    next(error);
  }
}

async function getFeedbackById(req, res, next) {
  try {
    const feedback = await feedbackModel.getFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback não encontrado" });
    }
    return res.status(200).json(feedback);
  } catch (error) {
    next(error);
  }
}

async function updateFeedbackStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status é obrigatório" });
    }
    const updated = await feedbackModel.updateFeedbackStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ message: "Feedback não encontrado" });
    }
    return res.status(200).json({
      message: "Status do feedback atualizado com sucesso",
      feedback: updated
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendFeedback,
  listFeedbacks,
  getFeedbackById,
  updateFeedbackStatus
};