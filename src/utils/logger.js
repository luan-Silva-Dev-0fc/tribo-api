function info(message, meta) {
  if (meta) {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, meta);
    return;
  }

  console.log(`[INFO] ${new Date().toISOString()} ${message}`);
}

function warn(message, meta) {
  if (meta) {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, meta);
    return;
  }

  console.warn(`[WARN] ${new Date().toISOString()} ${message}`);
}

function error(message, meta) {
  if (meta) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, meta);
    return;
  }

  console.error(`[ERROR] ${new Date().toISOString()} ${message}`);
}

module.exports = {
  logger: { info, warn, error }
};