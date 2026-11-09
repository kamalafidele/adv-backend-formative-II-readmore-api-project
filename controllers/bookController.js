const Book = require('../models/Book');
const Author = require('../models/Author');
const { asyncHandler, isValidId, escapeRegex } = require('../utils/helpers');

const MIN_YEAR = 1450;
const SORTABLE_FIELDS = ['price', 'title', 'publishedYear'];
const REQUIRED_FIELDS = ['title', 'price', 'publishedYear', 'author'];

// ---------- helpers ----------

// Rule 3: things the schema can't express. Only checks fields that are present.
function validateBookRules({ title, price, publishedYear }) {
  const errors = [];

  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    errors.push('title must be a non-empty string');
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      errors.push('price must be a number');
    } else if (price <= 0) {
      errors.push('price must be greater than zero');
    }
  }
  if (publishedYear !== undefined) {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(publishedYear)) {
      errors.push('publishedYear must be a whole number');
    } else if (publishedYear < MIN_YEAR) {
      errors.push(`publishedYear cannot be before ${MIN_YEAR}`);
    } else if (publishedYear > currentYear) {
      errors.push(`publishedYear cannot be in the future (latest allowed: ${currentYear})`);
    }
  }
  return errors;
}

async function authorExists(authorId) {
  if (!isValidId(authorId)) return false;
  const author = await Author.exists({ _id: authorId });

  return author != null;
}

// Rule 2: same title (case-insensitive) for the SAME author only.
async function titleTaken(authorId, title, excludeBookId) {
  const filter = { author: authorId, title: title.trim() };
  if (excludeBookId) filter._id = { $ne: excludeBookId };
  return Boolean(
    await Book.exists(filter).collation({ locale: 'en', strength: 2 })
  );
}

async function findBookOr404(req, res) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ message: `"${id}" is not a valid book id` });
    return null;
  }
  const book = await Book.findById(id);
  if (!book) {
    res.status(404).json({ message: `No book found with id ${id}` });
    return null;
  }
  return book;
}

// ---------- controllers ----------

// POST /books
exports.createBook = asyncHandler(async (req, res) => {
  const { title, genre, price, publishedYear, author } = req.body;

  const missing = REQUIRED_FIELDS.filter(
    (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ''
  );
  if (missing.length) {
    return res.status(400).json({ message: `Missing required field(s): ${missing.join(', ')}` });
  }

  // 1 — no orphan books
  if (!(await authorExists(author))) {
    return res.status(400).json({ message: `Author ${author} does not exist` });
  }

  // 3 — price / year rules
  const ruleErrors = validateBookRules({ title, price, publishedYear });
  if (ruleErrors.length) {
    return res.status(422).json({ message: 'Validation failed', errors: ruleErrors });
  }

  // 2 — no duplicate titles per author
  if (await titleTaken(author, title)) {
    return res.status(409).json({
      message: `This author already has a book titled "${title.trim()}"`,
    });
  }

  const book = await Book.create({ title, genre, price, publishedYear, author });
  await book.populate('author');
  res.status(201).json(book);
});

// GET /books  — dynamic filtering, sorting and pagination
exports.getBooks = asyncHandler(async (req, res) => {
  const { genre, minPrice, maxPrice, author, search, sort, order, page, limit } = req.query;

  // Query params can arrive as arrays/objects (?genre[]=a); only accept plain strings.
  for (const [name, value] of Object.entries({ genre, minPrice, maxPrice, author, search, sort, order, page, limit })) {
    if (value !== undefined && typeof value !== 'string') {
      return res.status(400).json({ message: `Query parameter "${name}" must be a single value` });
    }
  }

  // Build the filter ONLY from the parameters that are present.
  const filter = {};

  if (genre) filter.genre = new RegExp(`^${escapeRegex(genre)}$`, 'i');

  if (author) {
    if (!isValidId(author)) {
      return res.status(400).json({ message: `"${author}" is not a valid author id` });
    }
    filter.author = author;
  }

  if (search) filter.title = new RegExp(escapeRegex(search), 'i');

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) {
      const min = Number(minPrice);
      if (minPrice.trim() === '' || Number.isNaN(min)) {
        return res.status(400).json({ message: 'minPrice must be a number' });
      }
      filter.price.$gte = min;
    }
    if (maxPrice !== undefined) {
      const max = Number(maxPrice);
      if (maxPrice.trim() === '' || Number.isNaN(max)) {
        return res.status(400).json({ message: 'maxPrice must be a number' });
      }
      filter.price.$lte = max;
    }
    if (filter.price.$gte !== undefined && filter.price.$lte !== undefined && filter.price.$gte > filter.price.$lte) {
      return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice' });
    }
  }

  // Sorting (whitelisted so clients can't sort on arbitrary fields)
  let sortSpec = { _id: 1 };
  if (sort !== undefined) {
    if (!SORTABLE_FIELDS.includes(sort)) {
      return res.status(400).json({ message: `sort must be one of: ${SORTABLE_FIELDS.join(', ')}` });
    }
    if (order !== undefined && !['asc', 'desc'].includes(order.toLowerCase())) {
      return res.status(400).json({ message: 'order must be "asc" or "desc"' });
    }
    const direction = order && order.toLowerCase() === 'desc' ? -1 : 1;
    sortSpec = { [sort]: direction, _id: 1 }; // _id keeps pages stable when values tie
  }

  // Pagination
  const pageNum = page === undefined ? 1 : Number(page);
  const limitNum = limit === undefined ? 10 : Number(limit);
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return res.status(400).json({ message: 'page must be a whole number >= 1' });
  }
  if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ message: 'limit must be a whole number between 1 and 100' });
  }

  const [results, total] = await Promise.all([
    Book.find(filter)
      .collation({ locale: 'en', strength: 2 }) // case-insensitive title sorting
      .sort(sortSpec)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('author'),
    Book.countDocuments(filter),
  ]);

  res.json({
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
    results,
  });
});

// GET /books/:id
exports.getBook = asyncHandler(async (req, res) => {
  const book = await findBookOr404(req, res);
  if (!book) return;
  await book.populate('author');
  res.json(book);
});

// PUT /books/:id
exports.updateBook = asyncHandler(async (req, res) => {
  const book = await findBookOr404(req, res);
  if (!book) return;

  const updates = {};
  ['title', 'genre', 'price', 'publishedYear', 'author'].forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // Moving the book to another author must respect rule 1 as well.
  if (updates.author !== undefined && !(await authorExists(updates.author))) {
    return res.status(400).json({ message: `Author ${updates.author} does not exist` });
  }

  const ruleErrors = validateBookRules(updates);
  if (ruleErrors.length) {
    return res.status(422).json({ message: 'Validation failed', errors: ruleErrors });
  }

  // Duplicate check against the book as it WILL look after the update (excluding itself).
  const finalTitle = updates.title !== undefined ? updates.title : book.title;
  const finalAuthor = updates.author !== undefined ? updates.author : book.author;
  if (await titleTaken(finalAuthor, finalTitle, book._id)) {
    return res.status(409).json({
      message: `This author already has a book titled "${finalTitle.trim()}"`,
    });
  }

  book.set(updates);
  await book.save();
  await book.populate('author');
  res.json(book);
});

// DELETE /books/:id
exports.deleteBook = asyncHandler(async (req, res) => {
  const book = await findBookOr404(req, res);
  if (!book) return;

  await book.deleteOne();
  res.json({ message: `Book "${book.title}" deleted` });
});