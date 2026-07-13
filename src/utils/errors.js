class AppError extends Error {
  /**
   * @param {string} message - User-facing error message
   * @param {number} status - HTTP status code (default: 500)
   * @param {Error|null} originalError - The underlying system/database error (optional)
   */
  constructor(message, status = 500, originalError = null) {
    super(message);
    this.status = status;
    this.originalError = originalError;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
