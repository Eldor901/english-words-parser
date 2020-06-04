const mongoose = require('mongoose');

const WordPageSchema = new mongoose.Schema({
    word: {
        type: String,
        required: true,
        unique: true,
    },
    wordPage: {
        type: JSON,
        required: true,
    }
});

mongoose.model('WordPage', WordPageSchema);
