function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const response = {
    message: err.message || "Erro interno do servidor"
  };

  if (process.env.NODE_ENV !== "production" && statusCode === 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorMiddleware;