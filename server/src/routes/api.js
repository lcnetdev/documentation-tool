const express = require('express');
const filesRouter = require('./files');
const editorRouter = require('./editor');
const searchRouter = require('./search');
const auth = require('../middleware/auth');

const router = express.Router();

// Public routes: list repos, file tree, read files, navigation, images
router.use('/repos', filesRouter);

// Search routes (public)
router.use('/repos', searchRouter);

// Editor routes (require authentication)
router.use('/repos', auth, editorRouter);

module.exports = router;
