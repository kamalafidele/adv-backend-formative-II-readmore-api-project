const express = require('express');
const controller = require('../controllers/authorController');
 
const router = express.Router();
 
router.post('/', controller.createAuthor);
router.get('/', controller.getAuthors);
router.get('/:id', controller.getAuthor);
router.put('/:id', controller.updateAuthor);
router.delete('/:id', controller.deleteAuthor);
 
// Linking endpoints
router.get('/:id/books', controller.getAuthorBooks);
router.get('/:id/stats', controller.getAuthorStats);
 
module.exports = router;