'use strict';

/**
 * LUDAROPE POS — Administración de sucursales (solo ADMIN).
 * Usa las tablas existentes sin cambiar su estructura ni borrar registros.
 * Este router se monta en /api/admin/sucursales.
 * Es independiente de /api/sucursales (ruta compartida con otros módulos).
 */
const express = require('express');
const pool = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

const fallo = (res, codigo, mensaje) =>
  res.status(codigo).json({ ok: false, mensaje });

const idSeguro = (valor) => {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

function estadoPool() {
  return {
    total: pool.totalCount,
    libres: pool.idleCount,
    esperando: pool.waitingCount,
  };
}

// Registrar la petición ANTES de verificar el JWT.
// Así distinguimos un fallo de red o proxy de un bloqueo en la autorización o SQL.
router.use((req, res, next) => {
  const inicio = Date.now();
  let finalizada = false;

  console.log('[SUCURSALES] Petición recibida:', req.method, req.originalUrl);

  res.on('finish', () => {
    finalizada = true;
    console.log(
      '[SUCURSALES] Respuesta:',
      res.statusCode,
      `${Date.now() - inicio}ms`
    );
  });

  res.on('close', () => {
    if (!finalizada) {
      console.warn(
        '[SUCURSALES] Cliente desconectado antes de finalizar:',
        `${Date.now() - inicio}ms`,
        estadoPool()
      );
    }
  });

  next();
});

// Acceso exclusivo para administradores activos.
router.use(verificarToken, async (req, res, next) => {
  const id = idSeguro(
    req.usuario?.id_usuario ??
    req.usuario?.id ??
    req.usuario?.userId
  );

  if (!id) {
    console.warn('[SUCURSALES] JWT sin identificador de usuario válido');
    return fallo(res, 401, 'Inicia sesión nuevamente.');
  }

  try {
    console.log('[SUCURSALES] Validando administrador. Pool:', estadoPool());
    const inicio = Date.now();
    const { rows } = await pool.query(
      `SELECT id_usuario, rol, activo
       FROM public.usuarios
       WHERE id_usuario = $1
       LIMIT 1`,
      [id]
    );
    console.log('[SUCURSALES] Autorización SQL completada en', `${Date.now() - inicio}ms`);

    const usuario = rows[0];
    if (!usuario || !usuario.activo) {
      return fallo(res, 401, 'Tu usuario ya no está activo.');
    }

    if (String(usuario.rol).trim().toUpperCase() !== 'ADMIN') {
      return fallo(res, 403, 'Solo el administrador puede gestionar sucursales.');
    }

    req.adminId = id;
    next();
  } catch (error) {
    console.error('[SUCURSALES] Error de autorización:', error);
    return fallo(res, 500, 'No se pudo verificar tu acceso.');
  }
});

function validarDatos(body) {
  const nombre = String(body?.nombre ?? '').trim();
  const direccion = String(body?.direccion ?? '').trim();
  const telefono = String(body?.telefono ?? '').trim();

  if (nombre.length < 2 || nombre.length > 150) {
    return { error: 'El nombre de la sucursal debe tener entre 2 y 150 caracteres.' };
  }
  if (direccion.length > 2000) {
    return { error: 'La dirección no debe superar 2000 caracteres.' };
  }
  if (telefono.length > 20 || (telefono && !/^[+0-9()\s.\-]+$/.test(telefono))) {
    return {
      error: 'El teléfono debe tener máximo 20 caracteres y solo números o símbolos telefónicos.',
    };
  }

  return {
    nombre,
    direccion: direccion || null,
    telefono: telefono || null,
  };
}

function errorDb(res, error, etiqueta) {
  console.error(`[SUCURSALES] ${etiqueta}:`, error);

  if (error?.code === '23505') {
    return fallo(res, 409, 'Ya existe una sucursal con ese nombre.');
  }
  if (error?.code === '23514' || error?.code === '22001') {
    return fallo(res, 400, 'Revisa los datos de la sucursal.');
  }
  if (error?.code === '23503') {
    return fallo(res, 409, 'La operación entra en conflicto con datos relacionados.');
  }

  return fallo(res, 500, 'No fue posible completar la operación.');
}

const columnas = `
  s.id_sucursal,
  s.nombre,
  s.direccion,
  s.telefono,
  s.activa AS activo,
  s.fecha_creacion,
  (SELECT COUNT(*)::int
   FROM public.usuarios u
   WHERE u.id_sucursal = s.id_sucursal AND u.activo = TRUE
  ) AS usuarios_activos,
  (SELECT COUNT(*)::int
   FROM public.cajas c
   WHERE c.id_sucursal = s.id_sucursal AND c.activo = TRUE
  ) AS cajas_activas,
  (SELECT COUNT(*)::int
   FROM public.caja_sesiones cs
   WHERE cs.id_sucursal = s.id_sucursal AND cs.estado = 'ABIERTA'
  ) AS sesiones_abiertas,
  (SELECT COALESCE(SUM(i.cantidad), 0)::int
   FROM public.inventario_sucursales i
   WHERE i.id_sucursal = s.id_sucursal
  ) AS prendas_existencia
`;

// GET /api/admin/sucursales — listado completo (activas e inactivas).
router.get('/', async (req, res) => {
  const buscar = String(req.query?.buscar ?? '').trim().slice(0, 100);

  console.log('[SUCURSALES] Iniciando listado. Pool:', estadoPool());
  const inicio = Date.now();

  try {
    const resultado = await pool.query(
      `SELECT ${columnas}
       FROM public.sucursales s
       WHERE (
         $1::text = ''
         OR s.nombre ILIKE '%' || $1 || '%'
         OR COALESCE(s.direccion, '') ILIKE '%' || $1 || '%'
         OR COALESCE(s.telefono, '') ILIKE '%' || $1 || '%'
       )
       ORDER BY s.activa DESC, s.nombre ASC, s.id_sucursal ASC`,
      [buscar]
    );

    console.log(
      '[SUCURSALES] Listado SQL completado:',
      resultado.rowCount,
      'registros en',
      `${Date.now() - inicio}ms`
    );

    return res.json({
      ok: true,
      sucursales: resultado.rows,
      total: resultado.rowCount,
    });
  } catch (error) {
    console.error('[SUCURSALES] Falló listado después de', `${Date.now() - inicio}ms`);
    return errorDb(res, error, 'Sucursales/listar');
  }
});

// POST /api/admin/sucursales — crear sucursal.
router.post('/', async (req, res) => {
  const datos = validarDatos(req.body);
  if (datos.error) return fallo(res, 400, datos.error);

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(62410, 1)');

    const repetida = await client.query(
      `SELECT 1 FROM public.sucursales
       WHERE lower(btrim(nombre)) = lower($1) LIMIT 1`,
      [datos.nombre]
    );
    if (repetida.rowCount) {
      await client.query('ROLLBACK');
      return fallo(res, 409, 'Ya existe una sucursal con ese nombre.');
    }

    const resultado = await client.query(
      `INSERT INTO public.sucursales (nombre, direccion, telefono, activa)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id_sucursal, nombre, direccion, telefono,
                 activa AS activo, fecha_creacion`,
      [datos.nombre, datos.direccion, datos.telefono]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      ok: true,
      sucursal: resultado.rows[0],
      mensaje: 'Sucursal registrada correctamente.',
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return errorDb(res, error, 'Sucursales/crear');
  } finally {
    if (client) client.release();
  }
});

// PUT /api/admin/sucursales/:id — editar contacto sin mover relaciones.
router.put('/:id', async (req, res) => {
  const id = idSeguro(req.params.id);
  if (!id) return fallo(res, 400, 'Identificador de sucursal inválido.');

  const datos = validarDatos(req.body);
  if (datos.error) return fallo(res, 400, datos.error);

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(62410, 1)');

    const existe = await client.query(
      'SELECT 1 FROM public.sucursales WHERE id_sucursal = $1 FOR UPDATE',
      [id]
    );
    if (!existe.rowCount) {
      await client.query('ROLLBACK');
      return fallo(res, 404, 'Sucursal no encontrada.');
    }

    const repetida = await client.query(
      `SELECT 1 FROM public.sucursales
       WHERE lower(btrim(nombre)) = lower($1)
         AND id_sucursal <> $2 LIMIT 1`,
      [datos.nombre, id]
    );
    if (repetida.rowCount) {
      await client.query('ROLLBACK');
      return fallo(res, 409, 'Ya existe otra sucursal con ese nombre.');
    }

    const resultado = await client.query(
      `UPDATE public.sucursales
       SET nombre = $2, direccion = $3, telefono = $4
       WHERE id_sucursal = $1
       RETURNING id_sucursal, nombre, direccion, telefono,
                 activa AS activo, fecha_creacion`,
      [id, datos.nombre, datos.direccion, datos.telefono]
    );

    await client.query('COMMIT');
    return res.json({
      ok: true,
      sucursal: resultado.rows[0],
      mensaje: 'Sucursal actualizada correctamente.',
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return errorDb(res, error, 'Sucursales/editar');
  } finally {
    if (client) client.release();
  }
});

/**
 * Impedir desactivar una sucursal con operaciones pendientes.
 * No elimina inventario, usuarios, cajas, ventas ni registros históricos.
 */
async function bloqueosDesactivacion(client, id) {
  const r = await client.query(
    `SELECT
       (SELECT COUNT(*)::int FROM public.usuarios
        WHERE id_sucursal = $1 AND activo = TRUE) AS usuarios,
       (SELECT COUNT(*)::int FROM public.cajas
        WHERE id_sucursal = $1 AND activo = TRUE) AS cajas,
       (SELECT COUNT(*)::int FROM public.caja_sesiones
        WHERE id_sucursal = $1 AND estado = 'ABIERTA') AS sesiones,
       (SELECT COALESCE(SUM(cantidad), 0)::int FROM public.inventario_sucursales
        WHERE id_sucursal = $1) AS inventario`,
    [id]
  );

  const b = r.rows[0];
  if (b.sesiones > 0) return 'Primero cierra las sesiones de caja abiertas de esta sucursal.';
  if (b.cajas > 0) return 'Primero desactiva todas las cajas de esta sucursal en Configuración de cajas.';
  if (b.usuarios > 0) return 'Primero reasigna o desactiva los usuarios activos vinculados a esta sucursal.';
  if (b.inventario > 0) return 'La sucursal tiene prendas en existencia. Transfiérelas o ajusta el inventario antes de desactivarla.';
  return null;
}

// PATCH /api/admin/sucursales/:id/estado — activar/desactivar sin borrado.
router.patch('/:id/estado', async (req, res) => {
  const id = idSeguro(req.params.id);
  if (!id || typeof req.body?.activo !== 'boolean') {
    return fallo(res, 400, 'Indica una sucursal válida y el estado activo (true/false).');
  }

  const activo = req.body.activo;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(62410, 1)');

    const s = await client.query(
      'SELECT * FROM public.sucursales WHERE id_sucursal = $1 FOR UPDATE',
      [id]
    );
    if (!s.rowCount) {
      await client.query('ROLLBACK');
      return fallo(res, 404, 'Sucursal no encontrada.');
    }

    if (s.rows[0].activa === activo) {
      await client.query('COMMIT');
      return res.json({
        ok: true,
        mensaje: activo ? 'La sucursal ya estaba activa.' : 'La sucursal ya estaba inactiva.',
      });
    }

    if (!activo) {
      const bloqueo = await bloqueosDesactivacion(client, id);
      if (bloqueo) {
        await client.query('ROLLBACK');
        return fallo(res, 409, bloqueo);
      }
    }

    await client.query(
      'UPDATE public.sucursales SET activa = $2 WHERE id_sucursal = $1',
      [id, activo]
    );
    await client.query('COMMIT');

    return res.json({
      ok: true,
      mensaje: activo ? 'Sucursal activada correctamente.' : 'Sucursal desactivada correctamente.',
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return errorDb(res, error, 'Sucursales/cambiar estado');
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
