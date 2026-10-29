
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ========================================
// VERIFICAR TOKEN JWT
// ========================================
const verificarToken = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const [tipo, token] = authorization.split(' ');

  if (tipo?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Token de autenticación requerido'
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Token inválido o expirado'
    });
  }

  try {
    const resultado = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.nombre,
        u.usuario,
        u.rol,
        u.id_sucursal,
        u.activo,
        s.nombre AS sucursal,
        s.activa AS sucursal_activa
      FROM usuarios u
      LEFT JOIN sucursales s
        ON s.id_sucursal = u.id_sucursal
      WHERE u.id_usuario = $1
      `,
      [decoded.id_usuario]
    );

    const usuario = resultado.rows[0];

    if (!usuario || !usuario.activo) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Usuario no autorizado'
      });
    }

    if (!['ADMIN', 'CAJERO'].includes(usuario.rol)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'Rol no autorizado'
      });
    }

    if (
      usuario.rol === 'CAJERO' &&
      (!usuario.id_sucursal || !usuario.sucursal_activa)
    ) {
      return res.status(403).json({
        ok: false,
        mensaje: 'Sucursal no disponible'
      });
    }

    req.usuario = {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      rol: usuario.rol,
      id_sucursal: usuario.id_sucursal,
      sucursal: usuario.sucursal
    };

    next();

  } catch (error) {
    console.error('Error al verificar sesión:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error al validar la sesión'
    });
  }
};

// ========================================
// VERIFICAR PERMISOS POR ROL
// ========================================
const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (
      !req.usuario ||
      !rolesPermitidos.includes(req.usuario.rol)
    ) {
      return res.status(403).json({
        ok: false,
        mensaje: 'No tienes permisos para esta acción'
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  autorizarRoles
};
