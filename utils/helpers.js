// Handling thrown errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
 
// Validating Mongo ObjectId
const isValidId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
 
// Escaping user text so it can be placed safely inside a RegExp.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 
module.exports = { asyncHandler, isValidId, escapeRegex };