'use strict';
/**
 * LUDAROPE · Dashboard administrativo con datos PostgreSQL reales.
 * No modifica inventario, ventas, pagos ni caja. No usa datos de demostración.
 * Se requiere el esquema que incluye ventas_detalle.costo_unitario_venta.
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');

const ZONA = 'America/Mexico_City';
const RESPONDER_ERROR = (res, codigo, mensaje) => res.status(codigo).json({ ok: false, mensaje });

function fechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

// CTE aislado de una fila por venta. Nunca conectar ventas_pagos y ventas_detalle
// directamente en el mismo JOIN de métricas: multiplicaría importes mixtos.
const VENTAS = `
  WITH ventas_periodo AS (
    SELECT v.*
    FROM public.ventas v
    WHERE v.estado = 'COMPLETADA'
      AND v.fecha_venta >= ($1::date::timestamp AT TIME ZONE '${ZONA}')
      AND v.fecha_venta < (($2::date + INTERVAL '1 day') AT TIME ZONE '${ZONA}')
      AND ($3::integer IS NULL OR v.id_sucursal = $3::integer)
  )
`;

// Cantidades monetarias llegan como NUMERIC de PostgreSQL: mantener dos decimales
// y convertir a número para que Recharts no grafique textos.
const n = (x) => x === null || x === undefined ? null : Number(x);

router.get('/resumen', verificarToken, autorizarRoles('ADMIN'), async (req, res) => {
  const { sucursal = 'todas', fecha_inicio, fecha_fin } = req.query;
  if (!fechaValida(fecha_inicio) || !fechaValida(fecha_fin) || fecha_inicio > fecha_fin) {
    return RESPONDER_ERROR(res, 400, 'Selecciona un rango de fechas válido.');
  }
  let idSucursal = null;
  if (sucursal !== 'todas') {
    if (!/^\d+$/.test(String(sucursal)) || !Number.isSafeInteger(Number(sucursal)) || Number(sucursal) <= 0) {
      return RESPONDER_ERROR(res, 400, 'Sucursal inválida.');
    }
    idSucursal = Number(sucursal);
  }

  let db;
  try {
    db = await pool.connect();
    await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    if (idSucursal !== null) {
      // También permite consultar sucursales históricas inactivas.
      const existe = await db.query('SELECT 1 FROM public.sucursales WHERE id_sucursal=$1', [idSucursal]);
      if (!existe.rowCount) {
        await db.query('ROLLBACK');
        return RESPONDER_ERROR(res, 404, 'No se encontró la sucursal indicada.');
      }
    }
    const p = [fecha_inicio, fecha_fin, idSucursal];

    const resumenVentas = (await db.query(`${VENTAS}
      SELECT COUNT(*)::integer AS total_ventas,
        COALESCE(SUM(total),0) AS total_vendido,
        COALESCE(SUM(descuento_total),0) AS descuentos_aplicados,
        COALESCE(AVG(total),0) AS ticket_promedio
      FROM ventas_periodo`, p)).rows[0];

    const costosVentas = (await db.query(`${VENTAS}
      SELECT COALESCE(SUM(d.cantidad),0)::integer AS prendas_vendidas,
        COUNT(*) FILTER (WHERE d.id_detalle IS NOT NULL AND d.costo_unitario_venta IS NULL)::integer AS lineas_sin_costo,
        CASE WHEN COUNT(*) FILTER (WHERE d.id_detalle IS NOT NULL AND d.costo_unitario_venta IS NULL) > 0 THEN NULL
          ELSE COALESCE(SUM(d.total_linea - d.costo_unitario_venta * d.cantidad),0) END AS utilidad_bruta
      FROM ventas_periodo v
      LEFT JOIN public.ventas_detalle d ON d.id_venta=v.id_venta`, p)).rows[0];

    const inventario = (await db.query(`
      SELECT COALESCE(SUM(i.cantidad),0)::integer AS prendas_disponibles,
        COUNT(*) FILTER (WHERE i.cantidad > 0 AND c.costo_unitario IS NULL)::integer AS referencias_sin_costo,
        CASE WHEN COUNT(*) FILTER (WHERE i.cantidad > 0 AND c.costo_unitario IS NULL) > 0 THEN NULL
          ELSE COALESCE(SUM(i.cantidad * c.costo_unitario),0) END AS valor_inventario
      FROM public.inventario_sucursales i
      LEFT JOIN public.prendas_costos c ON c.id_prenda=i.id_prenda
      WHERE ($1::integer IS NULL OR i.id_sucursal=$1::integer)
    `, [idSucursal])).rows[0];

    const ventasDiarias = (await db.query(`${VENTAS}
      , diario AS (
        SELECT (fecha_venta AT TIME ZONE '${ZONA}')::date AS dia,
          SUM(total) AS total
        FROM ventas_periodo GROUP BY (fecha_venta AT TIME ZONE '${ZONA}')::date
      )
      SELECT TO_CHAR(dia, 'DD/MM') AS fecha, dia AS fecha_iso, total
      FROM diario ORDER BY dia`, p)).rows;

    const categorias = (await db.query(`${VENTAS}
      SELECT COALESCE(cat.nombre,'Sin categoría') AS categoria,
        SUM(d.total_linea) AS total,
        SUM(d.cantidad)::integer AS cantidad,
        CASE WHEN COUNT(*) FILTER (WHERE d.costo_unitario_venta IS NULL) > 0 THEN NULL
          ELSE SUM(d.total_linea - d.costo_unitario_venta * d.cantidad) END AS utilidad
      FROM ventas_periodo v
      JOIN public.ventas_detalle d ON d.id_venta=v.id_venta
      LEFT JOIN public.prendas pr ON pr.id_prenda=d.id_prenda
      LEFT JOIN public.categorias cat ON cat.id_categoria=pr.id_categoria
      GROUP BY COALESCE(cat.nombre,'Sin categoría')
      ORDER BY total DESC LIMIT 10`, p)).rows;

    const pagos = (await db.query(`${VENTAS}
      SELECT vp.metodo AS codigo_metodo, SUM(vp.monto) AS total
      FROM ventas_periodo v
      JOIN public.ventas_pagos vp ON vp.id_venta=v.id_venta
      GROUP BY vp.metodo
      ORDER BY CASE vp.metodo
        WHEN 'EFECTIVO' THEN 1 WHEN 'DEBITO' THEN 2
        WHEN 'CREDITO' THEN 3 ELSE 4 END`, p)).rows;

    const sucursalesCorrectas = (await db.query(`${VENTAS}
      , totales AS (
        SELECT v.id_sucursal, SUM(v.total) AS total FROM ventas_periodo v GROUP BY v.id_sucursal
      ), utilidad AS (
        SELECT v.id_sucursal,
          CASE WHEN COUNT(*) FILTER (WHERE d.costo_unitario_venta IS NULL) > 0 THEN NULL
            ELSE SUM(d.total_linea - d.costo_unitario_venta*d.cantidad) END AS utilidad
        FROM ventas_periodo v JOIN public.ventas_detalle d ON d.id_venta=v.id_venta
        GROUP BY v.id_sucursal
      )
      SELECT COALESCE(s.nombre,'Sucursal no disponible') AS sucursal,
        t.total, CASE WHEN u.id_sucursal IS NULL THEN 0 ELSE u.utilidad END AS utilidad
      FROM totales t
      LEFT JOIN utilidad u ON u.id_sucursal=t.id_sucursal
      LEFT JOIN public.sucursales s ON s.id_sucursal=t.id_sucursal
      ORDER BY t.total DESC`, p)).rows;

    const ultimasVentas = (await db.query(`${VENTAS}
      SELECT v.id_venta,v.folio,v.fecha_venta,v.total,
        COALESCE(v.nombre_sucursal,s.nombre,'Sucursal no disponible') AS sucursal,
        COALESCE(v.nombre_cajero,u.nombre,'Usuario no disponible') AS cajero,
        COALESCE((SELECT CASE WHEN COUNT(DISTINCT vp.metodo)>1 THEN 'Mixto'
          ELSE MAX(CASE vp.metodo WHEN 'EFECTIVO' THEN 'Efectivo'
            WHEN 'DEBITO' THEN 'Débito' WHEN 'CREDITO' THEN 'Crédito'
            WHEN 'TRANSFERENCIA' THEN 'Transferencia' END) END
          FROM public.ventas_pagos vp WHERE vp.id_venta=v.id_venta), '—') AS metodo_pago
      FROM ventas_periodo v
      LEFT JOIN public.sucursales s ON s.id_sucursal=v.id_sucursal
      LEFT JOIN public.usuarios u ON u.id_usuario=v.id_usuario
      ORDER BY v.fecha_venta DESC,v.id_venta DESC LIMIT 10`, p)).rows;

    const sinMovimiento = (await db.query(`
      WITH ultima_venta AS (
        SELECT vd.id_prenda,v.id_sucursal,MAX(v.fecha_venta) AS fecha_ultima
        FROM public.ventas_detalle vd
        JOIN public.ventas v ON v.id_venta=vd.id_venta AND v.estado='COMPLETADA'
        GROUP BY vd.id_prenda,v.id_sucursal
      )
      SELECT pr.id_prenda,pr.nombre AS prenda,
        COALESCE(cat.nombre,'Sin categoría') AS categoria,
        s.nombre AS sucursal,
        GREATEST(0,(NOW() AT TIME ZONE '${ZONA}')::date -
          COALESCE((uv.fecha_ultima AT TIME ZONE '${ZONA}')::date,
                   (pr.fecha_creacion AT TIME ZONE '${ZONA}')::date))::integer AS dias,
        (i.cantidad*c.costo_unitario) AS costo
      FROM public.inventario_sucursales i
      JOIN public.prendas pr ON pr.id_prenda=i.id_prenda
      JOIN public.sucursales s ON s.id_sucursal=i.id_sucursal
      LEFT JOIN public.categorias cat ON cat.id_categoria=pr.id_categoria
      LEFT JOIN public.prendas_costos c ON c.id_prenda=pr.id_prenda
      LEFT JOIN ultima_venta uv ON uv.id_prenda=i.id_prenda AND uv.id_sucursal=i.id_sucursal
      WHERE i.cantidad>0 AND ($1::integer IS NULL OR i.id_sucursal=$1::integer)
      ORDER BY dias DESC,pr.id_prenda LIMIT 100`, [idSucursal])).rows;

    const utilidadDetalle = (await db.query(`${VENTAS}
      SELECT d.id_detalle,d.id_prenda,
        COALESCE(d.nombre_prenda,pr.nombre,'Prenda') AS prenda,
        COALESCE(cat.nombre,'Sin categoría') AS categoria,
        COALESCE(v.nombre_sucursal,s.nombre,'Sucursal no disponible') AS sucursal,
        d.cantidad,
        (d.costo_unitario_venta*d.cantidad) AS costo,
        d.total_linea AS venta,
        CASE WHEN d.costo_unitario_venta IS NULL THEN NULL
          ELSE (d.total_linea-d.costo_unitario_venta*d.cantidad) END AS utilidad,
        CASE WHEN d.costo_unitario_venta IS NULL OR d.total_linea=0 THEN NULL
          ELSE ROUND((d.total_linea-d.costo_unitario_venta*d.cantidad)*100/NULLIF(d.total_linea,0),2) END AS margen
      FROM ventas_periodo v
      JOIN public.ventas_detalle d ON d.id_venta=v.id_venta
      LEFT JOIN public.prendas pr ON pr.id_prenda=d.id_prenda
      LEFT JOIN public.categorias cat ON cat.id_categoria=pr.id_categoria
      LEFT JOIN public.sucursales s ON s.id_sucursal=v.id_sucursal
      ORDER BY v.fecha_venta DESC,d.id_detalle DESC LIMIT 1001`, p)).rows;

    const promocionesReporte = (await db.query(`${VENTAS}
      SELECT vp.nombre_promocion AS promocion,
         SUM(vp.descuento_total) AS ahorro,
         COUNT(DISTINCT vp.id_venta)::integer AS operaciones
      FROM ventas_periodo v
      JOIN public.ventas_promociones vp ON vp.id_venta=v.id_venta
      GROUP BY vp.nombre_promocion ORDER BY ahorro DESC LIMIT 30`,p)).rows;

    await db.query('COMMIT');
    const avisos = [];
    if (costosVentas.lineas_sin_costo > 0) avisos.push(`${costosVentas.lineas_sin_costo} línea(s) vendida(s) sin costo histórico. La utilidad queda pendiente, no se considera costo cero.`);
    if (inventario.referencias_sin_costo > 0) avisos.push(`${inventario.referencias_sin_costo} referencia(s) con existencias sin costo de compra. La valoración del inventario queda pendiente.`);
    if (utilidadDetalle.length > 1000) avisos.push('El detalle de utilidad muestra los 1,000 movimientos más recientes del periodo; acota las fechas para exportar el resto.');

    return res.json({
      ok: true, disponible: true, mensaje: avisos.join(' '),
      resumen: {
        total_vendido: n(resumenVentas.total_vendido),
        descuentos_aplicados: n(resumenVentas.descuentos_aplicados),
        utilidad_bruta: n(costosVentas.utilidad_bruta),
        prendas_vendidas: Number(costosVentas.prendas_vendidas),
        total_ventas: Number(resumenVentas.total_ventas),
        ticket_promedio: n(resumenVentas.ticket_promedio),
        prendas_disponibles: Number(inventario.prendas_disponibles),
        valor_inventario: n(inventario.valor_inventario),
      },
      promociones_resumen: promocionesReporte.map(x=>({...x,ahorro:n(x.ahorro)})),
      costos_pendientes: {
        ventas: Number(costosVentas.lineas_sin_costo),
        inventario: Number(inventario.referencias_sin_costo),
      },
      ventas_diarias: ventasDiarias.map(r => ({ fecha: r.fecha, fecha_iso: r.fecha_iso, total: n(r.total) })),
      categorias_mas_vendidas: categorias.map(r => ({ ...r, total: n(r.total), utilidad: n(r.utilidad), cantidad: Number(r.cantidad) })),
      pagos_por_metodo: pagos.map(r => ({ metodo: ({ EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito', TRANSFERENCIA: 'Transferencia' })[r.codigo_metodo] || r.codigo_metodo, total: n(r.total) })),
      ventas_por_sucursal: sucursalesCorrectas.map(r => ({ ...r, total: n(r.total), utilidad: n(r.utilidad) })),
      ultimas_ventas: ultimasVentas.map(r => ({ ...r, total: n(r.total) })),
      prendas_sin_movimiento: sinMovimiento.map(r => ({ ...r, dias: Number(r.dias), costo: n(r.costo) })),
      detalle_utilidad: utilidadDetalle.slice(0,1000).map(r => ({ ...r, cantidad: Number(r.cantidad), costo: n(r.costo), venta: n(r.venta), utilidad: n(r.utilidad), margen: n(r.margen) })),
      detalle_utilidad_truncado: utilidadDetalle.length > 1000,
    });
  } catch (error) {
    if (db) { try { await db.query('ROLLBACK'); } catch (_) { /* si ya se liberó */ } }
    console.error('Error en dashboard real:', error);
    return RESPONDER_ERROR(res, 500, 'No fue posible consultar las estadísticas reales. Revisa los logs y las tablas de ventas/costos.');
  } finally {
    if (db) db.release();
  }
});

module.exports = router;
