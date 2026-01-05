/**
 * Async Handler Middleware
 * Wraps async route handlers to catch errors automatically
 */

/**
 * Wraps an async function to catch errors and pass them to next()
 * This eliminates the need for try/catch in every route handler
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 *
 * @example
 * // Instead of:
 * router.get('/topic', async (req, res, next) => {
 *   try {
 *     const result = await someAsyncOperation();
 *     res.json(result);
 *   } catch (err) {
 *     next(err);
 *   }
 * });
 *
 * // Use:
 * router.get('/topic', asyncHandler(async (req, res) => {
 *   const result = await someAsyncOperation();
 *   res.json(result);
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
