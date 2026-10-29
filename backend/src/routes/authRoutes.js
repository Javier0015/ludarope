
const express = require('express');
const router = express.Router();

const { login } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Iniciar sesión
router.post('/login', login);

// Consultar sesión actual
router.get('/me', verificarToken, (req, res) => {
  return res.json({
    ok: true,
    usuario: req.usuario
  });
});

module.exports = router;
