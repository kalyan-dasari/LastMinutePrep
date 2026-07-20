const express = require("express");
const notesController = require("../controllers/notesController");

const router = express.Router();

router.use("/", notesController);

module.exports = router;
