/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */
import { HTTP_STATUS, MESSAGES } from '../config/constants.js';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message = MESSAGES.MISSING_REQUIRED_FIELDS, details = null) {
        return new ApiError(HTTP_STATUS.BAD_REQUEST, message, details);
    }

    static unauthorized(message = MESSAGES.UNAUTHORIZED) {
        return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
    }

    static forbidden(message = MESSAGES.UNAUTHORIZED) {
        return new ApiError(HTTP_STATUS.FORBIDDEN, message);
    }

    static notFound(message = MESSAGES.NOT_FOUND) {
        return new ApiError(HTTP_STATUS.NOT_FOUND, message);
    }

    static internal(message = MESSAGES.SERVER_ERROR) {
        return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
}

/**
 * Not Found handler - 404 for unmatched routes
 */
export const notFoundHandler = (req, res, next) => {
    const error = ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`);
    next(error);
};

/**
 * Global error handler middleware
 * Must be the last middleware in the chain
 */
export const errorHandler = (err, req, res, next) => {
    // Default to 500 Internal Server Error
    let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = err.message || MESSAGES.SERVER_ERROR;
    let details = err.details || null;

    // Log error for debugging
    if (statusCode >= 500) {
        console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
    } else {
        console.warn(`[WARN] ${req.method} ${req.originalUrl}: ${message}`);
    }

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'Validation failed';
        details = err.errors;
    }

    if (err.name === 'JsonWebTokenError') {
        statusCode = HTTP_STATUS.UNAUTHORIZED;
        message = MESSAGES.INVALID_TOKEN;
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = HTTP_STATUS.UNAUTHORIZED;
        message = 'Token has expired';
    }

    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'File too large';
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'Unexpected file field';
    }

    // Send error response
    const response = {
        success: false,
        error: message
    };

    if (details) {
        response.details = details;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};

export default errorHandler;
