'use strict';

/**
 * LUDAROPE POS — Administración de usuarios.
 * Tabla existente: public.usuarios(id_usuario, nombre, usuario, password_hash,
 * rol, id_sucursal, activo, fecha_creacion, ultimo_acceso).
 * Migración 04 agrega exclusivamente usuarios.correo (opcional).
 * Roles admitidos: ADMIN / CAJERO.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();
const ROLES = new Set(['ADMIN', 'CAJERO']);
const USUARIO_RE = /^[a-zA-Z0-9._-]{4,60}$/;
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fallar = (res, status, mensaje) => res.status(status).json({ ok: false, mensaje });
const idValido = (valor) => {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const normalizarCorreo = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  return String(valor).trim().toLowerCase() || null;
};

// Evita que un token viejo mantenga permisos de administración después de
// desactivar al usuario o cambiar su rol. Se comprueba en BD en cada solicitud.
router.use(verificarToken, async (req, res, next) => {
  try {
    const id = idValido(req.usuario?.id_usuario);
    if (!id) return fallar(res, 401, 'La sesión no tiene un identificador de usuario válido.');
    const r = await pool.query(
      'SELECT rol, activo FROM public.usuarios WHERE id_usuario=$1', [id],
    );
    if (!r.rowCount || !r.rows[0].activo) {
      return fallar(res, 401, 'La cuenta no está activa. Inicia sesión nuevamente.');
    }
    if (String(r.rows[0].rol).toUpperCase() !== 'ADMIN') {
      return fallar(res, 403, 'Solo ADMIN puede gestionar usuarios.');
    }
    req.adminId = id;
    next();
  } catch (err) {
    console.error('Usuarios: verificación de permisos', err);
    return fallar(res, 500, 'No fue posible verificar el acceso.');
  }
});

const CAMPOS_PUBLICOS = `u.id_usuario, u.nombre, u.usuario, u.correo,
  u.rol, u.id_sucursal, u.activo, u.fecha_creacion, u.ultimo_acceso,
  s.nombre AS sucursal`;

async function sucursalExiste(client, idSucursal) {
  if (!idSucursal) return false;
  const r = await client.query(
    'SELECT 1 FROM public.sucursales WHERE id_sucursal=$1 AND activa=TRUE',
    [idSucursal],
  );
  return r.rowCount > 0;
}

async function nombreDisponible(client, usuario, idActual = null) {
  const r = await client.query(
    `SELECT id_usuario FROM public.usuarios
     WHERE lower(usuario)=lower($1) AND ($2::int IS NULL OR id_usuario<>$2) LIMIT 1`,
    [usuario, idActual],
  );
  return r.rowCount === 0;
}

function datosBasicos(body, { edicion = false } = {}) {
  const nombre = String(body?.nombre ?? '').trim();
  const usuario = String(body?.usuario ?? '').trim().toLowerCase();
  const rol = String(body?.rol ?? '').trim().toUpperCase();
  const correo = normalizarCorreo(body?.correo);
  const password = String(body?.password ?? '');
  const idSucursal = body?.id_sucursal === '' || body?.id_sucursal == null
    ? null : idValido(body.id_sucursal);

  if (nombre.length < 2 || nombre.length > 150) return { error: 'El nombre debe contener entre 2 y 150 caracteres.' };
  if (!USUARIO_RE.test(usuario)) return { error: 'El usuario debe tener 4 a 60 caracteres: letras, números, punto, guion o guion bajo.' };
  if (!ROLES.has(rol)) return { error: 'El rol debe ser ADMIN o CAJERO.' };
  if (correo && (correo.length > 254 || !CORREO_RE.test(correo))) return { error: 'El correo electrónico no es válido.' };
  if (body?.id_sucursal !== '' && body?.id_sucursal != null && !idSucursal) return { error: 'Selecciona una sucursal válida.' };
  if (rol === 'CAJERO' && !idSucursal) return { error: 'El cajero debe tener una sucursal asignada.' };
  if (!edicion && !password) return { error: 'La contraseña es obligatoria.' };
  if (password && (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72)) {
    return { error: 'La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.' };
  }
  if (body?.activo !== undefined && typeof body.activo !== 'boolean') return { error: 'El estado activo debe ser verdadero o falso.' };
  return { nombre, usuario, correo, rol, idSucursal, password, activo: body?.activo !== false };
}

async function tablaExiste(client, nombre) {
  const r = await client.query('SELECT to_regclass($1) AS tabla', [`public.${nombre}`]);
  return Boolean(r.rows[0]?.tabla);
}

/** Rechaza modificaciones que dejarían una sesión o asignación incoherente. */
async function tieneOperacionesVigentes(client, idUsuario, { cambiaSucursal, dejaCajero, desactiva }) {
  if (!(cambiaSucursal || dejaCajero || desactiva)) return null;
  if (await tablaExiste(client, 'caja_sesiones')) {
    const sesion = await client.query(
      `SELECT 1 FROM public.caja_sesiones
       WHERE id_usuario=$1 AND estado='ABIERTA' LIMIT 1`, [idUsuario],
    );
    if (sesion.rowCount) return 'Primero cierra la sesión de caja abierta de este usuario.';
  }
  if (await tablaExiste(client, 'cajas')) {
    const asignacion = await client.query(
      'SELECT 1 FROM public.cajas WHERE id_usuario_asignado=$1 AND activo=TRUE LIMIT 1',
      [idUsuario],
    );
    if (asignacion.rowCount) return 'Primero desasigna la caja activa en Configuración de cajas.';
  }
  return null;
}

async function asegurarOtroAdmin(client, idUsuario) {
  // La transacción usa un advisory lock (véase mutación) para serializar bajas
  // concurrentes de administradores.
  const r = await client.query(
    `SELECT COUNT(*)::int AS total FROM public.usuarios
     WHERE rol='ADMIN' AND activo=TRUE AND id_usuario<>$1`, [idUsuario],
  );
  return r.rows[0].total > 0;
}

function manejarError(res, err, etiqueta) {
  if (err?.code === '23505') return fallar(res, 409, 'El usuario o correo ya está registrado.');
  if (err?.code === '23503') return fallar(res, 409, 'La sucursal indicada no existe.');
  console.error(etiqueta, err);
  return fallar(res, 500, 'No fue posible completar la operación.');
}

// GET /api/usuarios/sucursales — para el formulario, solo activas.
router.get('/sucursales', async (_req, res) => {
  try {
    const r = await pool.query(
      'SELECT id_sucursal, nombre FROM public.sucursales WHERE activa=TRUE ORDER BY nombre',
    );
    res.json({ ok: true, sucursales: r.rows });
  } catch (err) { manejarError(res, err, 'Usuarios/sucursales'); }
});

// GET /api/usuarios?buscar= — sin contraseña ni datos de costos.
router.get('/', async (req, res) => {
  const buscar = String(req.query.buscar || '').trim().slice(0, 100);
  try {
    const r = await pool.query(
      `SELECT ${CAMPOS_PUBLICOS}
       FROM public.usuarios u
       LEFT JOIN public.sucursales s ON s.id_sucursal=u.id_sucursal
       WHERE u.rol IN ('ADMIN','CAJERO')
       AND ($1='' OR u.nombre ILIKE '%'||$1||'%' OR u.usuario ILIKE '%'||$1||'%'
         OR coalesce(u.correo,'') ILIKE '%'||$1||'%'
         OR u.rol ILIKE '%'||$1||'%'
         OR coalesce(s.nombre,'') ILIKE '%'||$1||'%')
       ORDER BY u.activo DESC, u.nombre, u.id_usuario`, [buscar],
    );
    res.json({ ok: true, usuarios: r.rows });
  } catch (err) { manejarError(res, err, 'Usuarios/lista'); }
});

// POST /api/usuarios
router.post('/', async (req, res) => {
  const d = datosBasicos(req.body);
  if (d.error) return fallar(res, 400, d.error);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (d.idSucursal && !await sucursalExiste(client, d.idSucursal)) {
      await client.query('ROLLBACK');
      return fallar(res, 400, 'La sucursal no existe o está inactiva.');
    }
    if (!await nombreDisponible(client, d.usuario)) {
      await client.query('ROLLBACK');
      return fallar(res, 409, 'Ese nombre de usuario ya existe.');
    }
    const hash = await bcrypt.hash(d.password, 12);
    const r = await client.query(
      `INSERT INTO public.usuarios(nombre,usuario,correo,password_hash,rol,id_sucursal,activo)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id_usuario`,
      [d.nombre,d.usuario,d.correo,hash,d.rol,d.idSucursal,d.activo],
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true, id_usuario: r.rows[0].id_usuario, mensaje: 'Usuario creado correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    manejarError(res, err, 'Usuarios/crear');
  } finally { client.release(); }
});

// PUT /api/usuarios/:id — contraseña opcional en edición.
router.put('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return fallar(res, 400, 'Identificador inválido.');
  const d = datosBasicos(req.body, { edicion: true });
  if (d.error) return fallar(res, 400, d.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(60720,1)');
    const actual = await client.query('SELECT * FROM public.usuarios WHERE id_usuario=$1 FOR UPDATE', [id]);
    if (!actual.rowCount) {
      await client.query('ROLLBACK'); return fallar(res, 404, 'Usuario no encontrado.');
    }
    const previo = actual.rows[0];
    if (!ROLES.has(previo.rol)) {
      await client.query('ROLLBACK'); return fallar(res, 403, 'Esta vista solo administra roles ADMIN y CAJERO.');
    }
    const cambiaSucursal = Number(previo.id_sucursal || 0) !== Number(d.idSucursal || 0);
    const dejaCajero = previo.rol === 'CAJERO' && d.rol !== 'CAJERO';
    const desactiva = previo.activo && !d.activo;

    if (id === req.adminId && (d.rol !== 'ADMIN' || !d.activo)) {
      await client.query('ROLLBACK'); return fallar(res, 409, 'No puedes quitarte el rol ADMIN ni desactivar tu propia cuenta.');
    }
    if (previo.rol === 'ADMIN' && previo.activo && (d.rol !== 'ADMIN' || !d.activo)) {
      if (!await asegurarOtroAdmin(client, id)) {
        await client.query('ROLLBACK'); return fallar(res, 409, 'Debe permanecer al menos un ADMIN activo.');
      }
    }
    if (d.idSucursal && !await sucursalExiste(client, d.idSucursal)) {
      await client.query('ROLLBACK'); return fallar(res, 400, 'La sucursal no existe o está inactiva.');
    }
    if (!await nombreDisponible(client, d.usuario, id)) {
      await client.query('ROLLBACK'); return fallar(res, 409, 'Ese nombre de usuario ya existe.');
    }
    const pendiente = await tieneOperacionesVigentes(client, id, { cambiaSucursal, dejaCajero, desactiva });
    if (pendiente) { await client.query('ROLLBACK'); return fallar(res, 409, pendiente); }

    const hash = d.password ? await bcrypt.hash(d.password, 12) : null;
    await client.query(
      `UPDATE public.usuarios SET nombre=$2,usuario=$3,correo=$4,rol=$5,
       id_sucursal=$6,activo=$7,password_hash=coalesce($8,password_hash)
       WHERE id_usuario=$1`,
      [id,d.nombre,d.usuario,d.correo,d.rol,d.idSucursal,d.activo,hash],
    );
    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Usuario actualizado correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    manejarError(res, err, 'Usuarios/editar');
  } finally { client.release(); }
});

// PATCH /api/usuarios/:id/estado — habilita o inhabilita sin borrar registros.
router.patch('/:id/estado', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id || typeof req.body?.activo !== 'boolean') {
    return fallar(res, 400, 'Identificador o estado inválido.');
  }
  const { activo } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(60720,1)');
    const r = await client.query('SELECT * FROM public.usuarios WHERE id_usuario=$1 FOR UPDATE', [id]);
    if (!r.rowCount) { await client.query('ROLLBACK'); return fallar(res, 404, 'Usuario no encontrado.'); }
    const previo = r.rows[0];
    if (!ROLES.has(previo.rol)) { await client.query('ROLLBACK'); return fallar(res, 403, 'Rol no administrable desde esta vista.'); }
    if (!activo && id === req.adminId) {
      await client.query('ROLLBACK'); return fallar(res, 409, 'No puedes desactivar tu propia cuenta.');
    }
    if (!activo && previo.rol === 'ADMIN' && previo.activo && !await asegurarOtroAdmin(client, id)) {
      await client.query('ROLLBACK'); return fallar(res, 409, 'Debe permanecer al menos un ADMIN activo.');
    }
    if (!activo) {
      const pendiente = await tieneOperacionesVigentes(client, id, { cambiaSucursal:false, dejaCajero:false, desactiva:previo.activo });
      if (pendiente) { await client.query('ROLLBACK'); return fallar(res, 409, pendiente); }
    } else if (previo.id_sucursal && !await sucursalExiste(client, previo.id_sucursal)) {
      await client.query('ROLLBACK'); return fallar(res, 409, 'La sucursal asignada ya no está activa.');
    }
    await client.query('UPDATE public.usuarios SET activo=$2 WHERE id_usuario=$1', [id, activo]);
    await client.query('COMMIT');
    res.json({ ok: true, mensaje: activo ? 'Usuario activado.' : 'Usuario desactivado.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    manejarError(res, err, 'Usuarios/estado');
  } finally { client.release(); }
});

module.exports = router;
