const Author = require('../models/Author');
const Book = require('../models/Book');
const { asyncHandler, isValidId } = require('../utils/helpers');
 
// Loads an author or sends the right error response. Returns null if it responded.
async function findAuthorOr404(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ message: `"${id}" is not a valid author id` });
    return null;
  }

  const author = await Author.findById(id);
  if (!author) {
    res.status(404).json({ message: `No author found with id ${id}` });
    return null;
  }

  return author;
}
 
// POST /authors
exports.createAuthor = asyncHandler(async (req, res) => {
  const { name, country, bio } = req.body;
  const author = await Author.create({ name, country, bio });
  res.status(201).json(author);
});
 
// GET /authors
exports.getAuthors = asyncHandler(async (req, res) => {
  const authors = await Author.find().sort({ name: 1 });
  res.json(authors);
});
 
// GET /authors/:id
exports.getAuthor = asyncHandler(async (req, res) => {
  const author = await findAuthorOr404(req, res);
  if (!author) return;
  res.json(author);
});
 
// PUT /authors/:id
exports.updateAuthor = asyncHandler(async (req, res) => {
  const author = await findAuthorOr404(req, res);
  if (!author) return;
 
  author.set({ ...req.body });
  await author.save();
  res.json(author);
});
 
// DELETE /authors/:id
exports.deleteAuthor = asyncHandler(async (req, res) => {
  const author = await findAuthorOr404(req, res);
  if (!author) return;
 
  // an author who still has books cannot be deleted
  const bookCount = await Book.countDocuments({ author: author._id });
  if (bookCount > 0) {
    return res.status(409).json({
      message: `Cannot delete "${author.name}": they still have ${bookCount} book(s). Delete or move those books first.`,
      bookCount,
    });
  }
 
  await author.deleteOne();
  res.json({ message: `Author "${author.name}" deleted` });
});
 
// GET /authors/:id/books
exports.getAuthorBooks = asyncHandler(async (req, res) => {
  const author = await findAuthorOr404(req, res);
  if (!author) return;
 
  const books = await Book.find({ author: author._id }).sort({ title: 1 });
  res.json(books);
});
 
// GET /authors/:id/stats
exports.getAuthorStats = asyncHandler(async (req, res) => {
  const author = await findAuthorOr404(req, res);
  if (!author) return;
 
  const books = await Book.find({ author: author._id }).select('title price').lean();
 
  // Returning report with zero stats instead null
  if (books.length === 0) {
    return res.json({
      author: author.name,
      bookCount: 0,
      averagePrice: 0,
      cheapestBook: null,
      mostExpensiveBook: null,
    });
  }
 
  const total = books.reduce((sum, b) => sum + b.price, 0);
  const cheapest = books.reduce((min, b) => (b.price < min.price ? b : min));
  const priciest = books.reduce((max, b) => (b.price > max.price ? b : max));
 
  res.json({
    author: author.name,
    bookCount: books.length,
    averagePrice: Math.round((total / books.length) * 100) / 100,
    cheapestBook: cheapest.title,
    mostExpensiveBook: priciest.title,
  });
});