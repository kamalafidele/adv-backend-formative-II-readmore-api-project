const express = require('express');
const dotenv = require('dotenv')

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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