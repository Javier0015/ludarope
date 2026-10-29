
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;

    if (
      typeof usuario !== 'string' ||
      typeof password !== 'string' ||
      !usuario.trim() ||
      !password
    ) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Usuario y contraseña obligatorios'
      });
    }

    const resultado = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.nombre,
        u.usuario,
        u.password_hash,
        u.rol,
        u.id_sucursal,
        u.activo,
        s.nombre AS sucursal,
        s.activa AS sucursal_activa
      FROM usuarios u
      LEFT JOIN sucursales s
        ON s.id_sucursal = u.id_sucursal
      WHERE LOWER(u.usuario) = LOWER($1)
      LIMIT 1
      `,
      [usuario.trim()]
    );

    const usuarioDB = resultado.rows[0];

    if (!usuarioDB) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas'
      });
    }

    const passwordValida = await bcrypt.compare(
      password,
      usuarioDB.password_hash
    );

    if (!passwordValida || !usuarioDB.activo) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas'
      });
    }

    if (
      usuarioDB.rol === 'CAJERO' &&
      !usuarioDB.sucursal_activa
    ) {
      return res.status(403).json({
        ok: false,
        mensaje: 'Sucursal no disponible'
      });
    }

    const token = jwt.sign(
      {
        id_usuario: usuarioDB.id_usuario,
        rol: usuarioDB.rol,
        id_sucursal: usuarioDB.id_sucursal
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h'
      }
    );

    await pool.query(
      `UPDATE usuarios
       SET ultimo_acceso = NOW()
       WHERE id_usuario = $1`,
      [usuarioDB.id_usuario]
    );

    return res.json({
      ok: true,
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id_usuario: usuarioDB.id_usuario,
        nombre: usuarioDB.nombre,
        usuario: usuarioDB.usuario,
        rol: usuarioDB.rol,
        id_sucursal: usuarioDB.id_sucursal,
        sucursal: usuarioDB.sucursal
      }
    });

  } catch (error) {
    console.error('Error login:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error al iniciar sesión'
    });
  }
};

module.exports = { login };
