const multer = require('multer');

// Memory storage for BLOB; later persist to Oracle
const storage = multer.memoryStorage();

module.exports = multer({ storage });
