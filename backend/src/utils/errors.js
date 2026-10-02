// Typed application error — caught by the global Express error handler.
export class AppError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Global Express error handler — always returns {message, code} (Section 8.7)
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
}
