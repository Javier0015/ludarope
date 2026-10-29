const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');

// El administrador consulta únicamente las sucursales activas.
router.get('/', verificarToken, autorizarRoles('ADMIN'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id_sucursal, nombre, direccion, telefono, activa
      FROM sucursales
      WHERE activa = TRUE
      ORDER BY id_sucursal ASC
    `);
    res.json({ ok: true, sucursales: rows });
  } catch (error) {
    console.error('Error al consultar sucursales:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al consultar sucursales' });
  }
});
module.exports = router;
