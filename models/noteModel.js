const mongoose = require('mongoose')

const noteSchema = new mongoose.Schema({
    chrome_identity_id: String,
    video_id: String,
    note: String,
    timestamp: Number
});

const Note = mongoose.model('Note', noteSchema);
module.exports = Note;