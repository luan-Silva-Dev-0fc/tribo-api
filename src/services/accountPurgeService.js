const userModel = require("../models/userModel");
const { logger } = require("../utils/logger");

async function runAccountPurge() {
  try {
    const result = await userModel.purgeExpiredDeletedAccounts();
    if (result.purgedCount > 0) {
      logger.info(`[AccountPurge] ${result.purgedCount} conta(s) expirada(s) foram purgadas definitivamente.`);
    }
    return result;
  } catch (error) {
    logger.error("[AccountPurge Error]", error.message);
    throw error;
  }
}

module.exports = {
  runAccountPurge
};