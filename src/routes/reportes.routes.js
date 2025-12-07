const express = require('express');
const router = express.Router();

const controller = require('../controllers/reportes.controller');
router.get('/prestamos', controller.consolidado);
router.get('/morosos', controller.morosos);
router.get('/refinanciaciones', controller.refinanciaciones);

module.exports = router;

