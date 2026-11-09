const mongoose = require('mongoose');
const { Schema } = mongoose;
 
const bookSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    genre: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    publishedYear: {
      type: Number,
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'Author',
      required: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);
 
// One title per author, case-insensitive comparison.
bookSchema.index(
  { author: 1, title: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
 
module.exports = mongoose.model('Book', bookSchema);