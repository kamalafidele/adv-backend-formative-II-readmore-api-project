const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const authorRoutes = require('./routes/authors');
const bookRoutes = require('./routes/books');

const app = express();
const PORT = process.env.PORT || 3000;
const { MONGODB_URI } = process.env;

mongoose.set('strictQuery', false);

// Parse incoming JSON requests
app.use(express.json());

// Log requests
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'ReadMore API is running' });
});

app.use('/authors', authorRoutes);
app.use('/books', bookRoutes);
 
// Unknown route
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

async function start() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in .env');
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('Could not connect to MongoDB', e);
    process.exit(1);
  }
}

start();