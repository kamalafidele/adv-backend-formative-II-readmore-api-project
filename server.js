const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const { MONGODB_URI } = process.env;

mongoose.set('strictQuery', false);

mongoose
  .connect(MONGODB_URI, {
    autoIndex: true,
  })
  .then(() => console.log('Successfully connected to MongoDb'))
  .catch((e) => console.log('Could not connect to MongoDb', e));

  
// Parsing incoming JSON requests
app.use(express.json());

// Logging requests
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});


app.get('/system-health', (req, res) => {
  res.send('Everything working as expected!');
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});