'use strict';
/**
 * LUDAROPE — historial administrativo de ventas.
 * Solo consulta y exporta. No modifica pagos, stock, sesiones o costos.
 * Base: SQL 01_ventas_base.sql + 02_pos_ticket_digital.sql + 03_cajas_configuracion.sql.
 */
const express = require('express');
const pool = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');
const { resumenSesion, aCentavos } = require('../services/cajaCore');

const router = express.Router();
const error = (res, status, mensaje) => res.status(status).json({ ok: false, mensaje });
const numeroId = (valor) => /^\d+$/.test(String(valor ?? '')) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
const METODOS = new Set(['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA']);
const ESTADOS = new Set(['COMPLETADA', 'CANCELADA']);
const ZONA = 'America/Mexico_City';

// No confiar en el rol declarado en la interfaz: confirmar rol y estado en BD.
router.use(verificarToken, async (req, res, next) => {
  const usuario = numeroId(req.usuario?.id_usuario);
  if (!usuario) return error(res, 401, 'Inicia sesión nuevamente.');
  try {
    const r = await pool.query('SELECT rol, activo FROM public.usuarios WHERE id_usuario=$1', [usuario]);
    if (!r.rowCount || !r.rows[0].activo) return error(res, 401, 'Tu sesión ya no está habilitada.');
    if (String(r.rows[0].rol).trim().toUpperCase() !== 'ADMIN') {
      return error(res, 403, 'Solo ADMIN puede consultar el historial general de ventas.');
    }
    next();
  } catch (e) {
    console.error('historial/auth', e);
    return error(res, 500, 'No se pudo verificar el acceso.');
  }
});

function fechaValida(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

function prepararFiltros(query = {}) {
  const params = [];
  const condiciones = [];
  const parametro = (v) => { params.push(v); return `$${params.length}`; };
  const buscar = String(query.buscar ?? '').trim().slice(0, 110);
  const inicio = String(query.desde ?? '').trim();
  const fin = String(query.hasta ?? '').trim();
  const sucursal = String(query.id_sucursal ?? '').trim();
  const usuario = String(query.id_usuario ?? '').trim();
  const metodo = String(query.metodo ?? '').trim().toUpperCase();
  const estado = String(query.estado ?? '').trim().toUpperCase();
  if (inicio && !fechaValida(inicio)) throw new Error('Fecha inicial inválida.');
  if (fin && !fechaValida(fin)) throw new Error('Fecha final inválida.');
  if (inicio && fin && inicio > fin) throw new Error('La fecha inicial no puede ser posterior a la final.');
  if (sucursal && !numeroId(sucursal)) throw new Error('Sucursal inválida.');
  if (usuario && !numeroId(usuario)) throw new Error('Usuario inválido.');
  if (metodo && !METODOS.has(metodo)) throw new Error('Método de pago inválido.');
  if (estado && !ESTADOS.has(estado)) throw new Error('Estado de venta inválido.');

  if (inicio) condiciones.push(`v.fecha_venta >= (${parametro(inicio)}::date::timestamp AT TIME ZONE '${ZONA}')`);
  if (fin) condiciones.push(`v.fecha_venta < ((${parametro(fin)}::date + INTERVAL '1 day') AT TIME ZONE '${ZONA}')`);
  if (sucursal) condiciones.push(`v.id_sucursal = ${parametro(Number(sucursal))}`);
  if (usuario) condiciones.push(`v.id_usuario = ${parametro(Number(usuario))}`);
  if (estado) condiciones.push(`v.estado = ${parametro(estado)}`);
  if (metodo) condiciones.push(`EXISTS (SELECT 1 FROM public.ventas_pagos vp0 WHERE vp0.id_venta=v.id_venta AND vp0.metodo=${parametro(metodo)})`);
  if (buscar) {
    const p = parametro(buscar);
    condiciones.push(`(
      v.folio ILIKE '%' || ${p} || '%'
      OR COALESCE(v.nombre_cajero, u.nombre, '') ILIKE '%' || ${p} || '%'
      OR COALESCE(v.nombre_sucursal, s.nombre, '') ILIKE '%' || ${p} || '%'
      OR EXISTS (
        SELECT 1 FROM public.ventas_detalle vd0
        LEFT JOIN public.prendas pr0 ON pr0.id_prenda=vd0.id_prenda
        WHERE vd0.id_venta=v.id_venta AND
          (COALESCE(vd0.nombre_prenda,pr0.nombre,'') ILIKE '%' || ${p} || '%'
           OR ('LDR-' || LPAD(vd0.id_prenda::text,6,'0')) ILIKE '%' || ${p} || '%')
      )
    )`);
  }
  const where = condiciones.length ? condiciones.join(' AND ') : 'TRUE';
  return { params, where };
}

// JOIN de relación uno a uno. Las formas de pago y detalles se agregan en subconsultas
// para no multiplicar renglones o inflar los indicadores.
const joins = `
  FROM public.ventas v
  LEFT JOIN public.usuarios u ON u.id_usuario=v.id_usuario
  LEFT JOIN public.sucursales s ON s.id_sucursal=v.id_sucursal
  LEFT JOIN public.caja_sesiones cs ON cs.id_sesion=v.id_sesion
  LEFT JOIN public.cajas c ON c.id_caja=cs.id_caja
`;

router.get('/filtros', async (_req, res) => {
  try {
    const [sucursales, cajeros] = await Promise.all([
      pool.query('SELECT id_sucursal, nombre, activa FROM public.sucursales ORDER BY nombre'),
      pool.query(`SELECT DISTINCT u.id_usuario, u.nombre
        FROM public.usuarios u JOIN public.ventas v ON v.id_usuario=u.id_usuario ORDER BY u.nombre`),
    ]);
    return res.json({ ok: true, sucursales: sucursales.rows, cajeros: cajeros.rows });
  } catch (e) {
    console.error('historial/filtros', e);
    return error(res, 500, 'No se pudieron consultar sucursales y cajeros.');
  }
});

router.get('/', async (req, res) => {
  let filtros;
  try { filtros = prepararFiltros(req.query); }
  catch (e) { return error(res, 400, e.message); }
  const pagina = numeroId(req.query.pagina ?? '1');
  const limite = numeroId(req.query.limite ?? '15');
  if (!pagina || !limite || limite > 100 || pagina > 100000) return error(res, 400, 'Paginación inválida.');
  const { params, where } = filtros;
  try {
    const selectListado = `SELECT v.id_venta,v.folio,v.fecha_venta,v.subtotal,v.descuento_total,
      v.total,v.estado,v.id_sucursal,v.id_usuario,v.id_sesion,
      COALESCE(v.nombre_sucursal,s.nombre,'Sucursal no disponible') AS sucursal,
      COALESCE(v.nombre_cajero,u.nombre,'Usuario no disponible') AS cajero,
      c.nombre AS caja,
      COALESCE((SELECT SUM(vd.cantidad)::integer FROM public.ventas_detalle vd WHERE vd.id_venta=v.id_venta),0) AS piezas,
      COALESCE((SELECT string_agg(vp.metodo, ', ' ORDER BY vp.id_pago) FROM public.ventas_pagos vp WHERE vp.id_venta=v.id_venta),'—') AS metodos
      ${joins} WHERE ${where} ORDER BY v.fecha_venta DESC,v.id_venta DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const [listado, totales, pagos] = await Promise.all([
      pool.query(selectListado, [...params, limite, (pagina - 1) * limite]),
      pool.query(`SELECT COUNT(*)::integer AS registros,
        COUNT(*) FILTER (WHERE v.estado='COMPLETADA')::integer AS completadas,
        COUNT(*) FILTER (WHERE v.estado='CANCELADA')::integer AS canceladas,
        COALESCE(SUM(v.total) FILTER (WHERE v.estado='COMPLETADA'),0) AS total_vendido,
        COALESCE(AVG(v.total) FILTER (WHERE v.estado='COMPLETADA'),0) AS ticket_promedio
        ${joins} WHERE ${where}`, params),
      pool.query(`SELECT vp.metodo, SUM(vp.monto) AS total,
        COUNT(DISTINCT v.id_venta)::integer AS ventas
        ${joins} JOIN public.ventas_pagos vp ON vp.id_venta=v.id_venta
        WHERE ${where} AND v.estado='COMPLETADA'
        GROUP BY vp.metodo ORDER BY vp.metodo`, params),
    ]);
    res.json({
      ok: true,
      ventas: listado.rows,
      resumen: totales.rows[0],
      pagos: pagos.rows,
      paginacion: { pagina, limite, total: totales.rows[0].registros, paginas: Math.ceil(totales.rows[0].registros / limite) },
    });
  } catch (e) {
    console.error('historial/listado', e);
    error(res, 500, 'No se pudo consultar el historial. Comprueba que las migraciones 01, 02 y 03 estén aplicadas.');
  }
});

// CSV exporta los registros del filtro sin costos privados.
function csvCelda(valor) {
  let s = String(valor ?? '').replace(/\r?\n|\r/g, ' ');
  // Excel / LibreOffice: neutralizar ejecución de fórmulas para campos ingresados por usuarios.
  if (/^[\s]*[=+@\-\t]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const fechaArchivo = (d) => new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(d));
router.get('/exportar.csv', async (req, res) => {
  let filtros;
  try { filtros = prepararFiltros(req.query); }
  catch (e) { return error(res, 400, e.message); }
  const { params, where } = filtros;
  try {
    const result = await pool.query(`SELECT v.folio,v.fecha_venta,v.estado,
      COALESCE(v.nombre_sucursal,s.nombre,'') AS sucursal,
      COALESCE(v.nombre_cajero,u.nombre,'') AS cajero,
      COALESCE(c.nombre,'') AS caja,v.subtotal,v.descuento_total,v.total,
      COALESCE((SELECT SUM(vd.cantidad)::integer FROM public.ventas_detalle vd WHERE vd.id_venta=v.id_venta),0) AS piezas,
      COALESCE((SELECT string_agg(vp.metodo || ': ' || vp.monto::text,' | ' ORDER BY vp.id_pago)
        FROM public.ventas_pagos vp WHERE vp.id_venta=v.id_venta),'') AS pagos
      ${joins} WHERE ${where} ORDER BY v.fecha_venta DESC,v.id_venta DESC LIMIT 20001`, params);
    if (result.rows.length > 20000) return error(res, 422, 'La consulta supera 20,000 ventas. Reduce el periodo para exportar.');
    const columnas = ['Folio','Fecha (CDMX)','Estado','Sucursal','Cajero','Caja','Piezas','Subtotal','Descuentos','Total','Pagos'];
    const contenido = ['\uFEFF' + columnas.map(csvCelda).join(',')];
    for (const v of result.rows) contenido.push([
      v.folio, fechaArchivo(v.fecha_venta), v.estado, v.sucursal,v.cajero,v.caja,
      v.piezas,v.subtotal,v.descuento_total,v.total,v.pagos,
    ].map(csvCelda).join(','));
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="LUDAROPE_Historial_Ventas.csv"', 'Cache-Control': 'private, no-store' });
    res.send(contenido.join('\r\n'));
  } catch (e) {
    console.error('historial/exportar', e);
    error(res, 500, 'No se pudo exportar el historial.');
  }
});


/**
 * Cancelación completa de una venta de la MISMA sesión ABIERTA.
 * La devolución de dinero es externa/manual y debe confirmarse en el UI.
 * No es un mecanismo de reembolso bancario ni de devolución parcial.
 */
router.post('/:id/cancelar', async (req, res) => {
  const ventaId = numeroId(req.params.id);
  const adminId = numeroId(req.usuario?.id_usuario);
  const motivo = String(req.body?.motivo ?? '').trim();
  const devolucionConfirmada = req.body?.confirmar_devolucion === true;
  if (!ventaId || !adminId) return error(res, 400, 'Venta o sesión inválida.');
  if (motivo.length < 10 || motivo.length > 500) {
    return error(res, 400, 'Escribe el motivo de la cancelación (10 a 500 caracteres).');
  }
  if (!devolucionConfirmada) {
    return error(res, 400, 'Confirma que se devolvieron los importes o se gestionaron los reembolsos externos.');
  }
  const db = await pool.connect();
  let enTransaccion = false;
  try {
    await db.query('BEGIN'); enTransaccion = true;
    await db.query("SET LOCAL lock_timeout='5s'");

    // Orden de bloqueo compatible con el POS y el cierre de caja: sesión -> venta -> existencias.
    const referencia = await db.query('SELECT id_sesion FROM public.ventas WHERE id_venta=$1', [ventaId]);
    if (!referencia.rowCount) {
      await db.query('ROLLBACK'); enTransaccion = false;
      return error(res, 404, 'Venta no encontrada.');
    }
    if (!referencia.rows[0].id_sesion) {
      await db.query('ROLLBACK'); enTransaccion = false;
      return error(res, 409, 'Esta venta no está asociada a una sesión de caja; requiere revisión administrativa.');
    }
    const sesion = await db.query(`SELECT id_sesion, id_sucursal, estado FROM public.caja_sesiones
      WHERE id_sesion=$1 FOR UPDATE`, [referencia.rows[0].id_sesion]);
    if (!sesion.rowCount || sesion.rows[0].estado !== 'ABIERTA') {
      await db.query('ROLLBACK'); enTransaccion = false;
      return error(res, 409, 'La caja de esta venta ya está cerrada. No se modificará un corte cerrado; registra una devolución en el proceso correspondiente.');
    }
    const venta = await db.query(`SELECT id_venta, folio, id_sucursal, id_sesion, estado, total
      FROM public.ventas WHERE id_venta=$1 FOR UPDATE`, [ventaId]);
    if (!venta.rowCount || Number(venta.rows[0].id_sesion) !== Number(sesion.rows[0].id_sesion)) {
      await db.query('ROLLBACK'); enTransaccion = false;
      return error(res, 409, 'La sesión de caja de esta venta cambió. Actualiza el historial.');
    }
    const v = venta.rows[0];
    if (v.estado !== 'COMPLETADA') {
      await db.query('ROLLBACK'); enTransaccion = false;
      return error(res, 409, 'Esta venta ya está cancelada. No puede cancelarse dos veces.');
    }
    if (Number(v.id_sucursal) !== Number(sesion.rows[0].id_sucursal)) {
      await db.query('ROLLBACK'); enTransaccion = false;
      return error(res, 409, 'La sucursal de venta y la de caja no coinciden.');
    }
    const detalle = await db.query(`SELECT id_prenda, SUM(cantidad)::int AS cantidad
      FROM public.ventas_detalle WHERE id_venta=$1
      GROUP BY id_prenda ORDER BY id_prenda`, [ventaId]);
    if (!detalle.rowCount) {
      await db.query('ROLLBACK'); enTransaccion = false;
      return error(res, 409, 'La venta carece de prendas. Requiere revisión administrativa.');
    }
    const pagos = await db.query(`SELECT metodo, monto, referencia
      FROM public.ventas_pagos WHERE id_venta=$1 ORDER BY id_pago`, [ventaId]);
    const efectivoReembolsado = pagos.rows
      .filter(p => p.metodo === 'EFECTIVO')
      .reduce((total, p) => total + (aCentavos(p.monto) || 0), 0);
    if (efectivoReembolsado > 0) {
      const corte = await resumenSesion(db, v.id_sesion);
      const disponible = aCentavos(corte?.resumen?.efectivo_esperado);
      if (disponible === null || disponible < efectivoReembolsado) {
        await db.query('ROLLBACK'); enTransaccion = false;
        return error(res, 409, 'El efectivo de la sesión no alcanza para registrar la devolución. Revisa retiros y movimientos de caja antes de cancelar.');
      }
    }
    // Bloquear existencias en orden fijo para minimizar deadlocks en devoluciones simultáneas.
    for (const linea of detalle.rows) {
      const existente = await db.query(`SELECT cantidad FROM public.inventario_sucursales
        WHERE id_prenda=$1 AND id_sucursal=$2 FOR UPDATE`, [linea.id_prenda, v.id_sucursal]);
      if (!existente.rowCount) {
        await db.query('ROLLBACK'); enTransaccion = false;
        return error(res, 409, `La prenda ${linea.id_prenda} no existe en el inventario de esta sucursal. Se requiere revisión.`);
      }
      const previo = Number(existente.rows[0].cantidad);
      const nuevo = previo + Number(linea.cantidad);
      await db.query(`UPDATE public.inventario_sucursales SET cantidad=$3,fecha_actualizacion=now()
        WHERE id_prenda=$1 AND id_sucursal=$2`, [linea.id_prenda, v.id_sucursal, nuevo]);
      await db.query(`INSERT INTO public.inventario_movimientos
        (id_prenda,id_sucursal,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo,observaciones)
        VALUES($1,$2,$3,'DEVOLUCION',$4,$5,$6,$7)`,
      [linea.id_prenda,v.id_sucursal,adminId,linea.cantidad,previo,nuevo,
        `Cancelación ${v.folio}. Motivo: ${motivo}`.slice(0,500)]);
    }
    const cancelada = await db.query(`UPDATE public.ventas
      SET estado='CANCELADA',fecha_cancelacion=now(),cancelado_por=$2,motivo_cancelacion=$3
      WHERE id_venta=$1 AND estado='COMPLETADA'
      RETURNING id_venta,folio,estado,fecha_cancelacion`, [ventaId,adminId,motivo]);
    if (!cancelada.rowCount) throw new Error('Estado de venta cambiado durante la cancelación.');
    await db.query(`INSERT INTO public.ventas_cancelaciones
      (id_venta,id_usuario,id_sesion,motivo,devolucion_confirmada,pagos_originales)
      VALUES ($1,$2,$3,$4,TRUE,$5::jsonb)`,
    [ventaId,adminId,v.id_sesion,motivo,JSON.stringify(pagos.rows)]);
    // El corte de esta sesión abierta excluye la venta CANCELADA automáticamente.
    // Por lo tanto, el efectivo esperado disminuye solo por el EFECTIVO original.
    // No se inserta caja_movimientos: hacerlo restaría ese efectivo DOS VECES.
    await db.query('COMMIT'); enTransaccion = false;
    return res.json({ ok:true, mensaje:'Venta cancelada y existencias restauradas.', venta:cancelada.rows[0] });
  } catch (e) {
    if (enTransaccion) await db.query('ROLLBACK').catch(() => {});
    console.error('historial/cancelacion', e);
    if (e.code === '55P03' || e.code === '40P01') return error(res, 409, 'La operación está ocupada. Actualiza y vuelve a intentarlo.');
    if (e.code === '23505') return error(res, 409, 'Esta venta ya tiene una cancelación registrada.');
    return error(res, 500, 'No fue posible cancelar la venta. No se realizaron cambios parciales.');
  } finally { db.release(); }
});

router.get('/:id', async (req, res) => {
  const ventaId = numeroId(req.params.id);
  if (!ventaId) return error(res, 400, 'Venta inválida.');
  try {
    const venta = await pool.query(`SELECT v.id_venta,v.folio,v.fecha_venta,v.subtotal,v.descuento_total,v.total,
      v.estado,v.fecha_cancelacion,v.motivo_cancelacion,v.observaciones,v.cancelado_por,
      uc.nombre AS nombre_usuario_cancelo,cs.estado AS estado_sesion,
      v.id_sucursal,v.id_usuario,v.id_sesion,v.monto_recibido,v.cambio,
      COALESCE(v.nombre_sucursal,s.nombre,'Sucursal no disponible') AS nombre_sucursal,
      COALESCE(v.direccion_sucursal,s.direccion,'') AS direccion_sucursal,
      COALESCE(v.nombre_cajero,u.nombre,'Usuario no disponible') AS nombre_cajero,
      c.nombre AS nombre_caja
      ${joins} LEFT JOIN public.usuarios uc ON uc.id_usuario=v.cancelado_por
      WHERE v.id_venta=$1`, [ventaId]);
    if (!venta.rowCount) return error(res, 404, 'No se encontró la venta.');
    const [detalles, pagos, envios, cancelaciones, promociones] = await Promise.all([
      pool.query(`SELECT vd.id_detalle,vd.id_prenda,vd.cantidad,vd.precio_lista,vd.precio_unitario,
        vd.descuento,vd.total_linea,vd.promociones_snapshot,COALESCE(vd.nombre_prenda,p.nombre,'Prenda') AS nombre_prenda,
        COALESCE(vd.talla,t.nombre,'') AS talla,COALESCE(vd.color,co.nombre,'') AS color,
        'LDR-' || LPAD(vd.id_prenda::text,6,'0') AS codigo,
        vd.fotos_venta AS fotos_snapshot_base64,
        (SELECT COALESCE(json_agg(pf.ruta ORDER BY pf.orden,pf.id_foto),'[]'::json)
          FROM public.prendas_fotos pf WHERE pf.id_prenda=vd.id_prenda) AS fotos_actuales
        FROM public.ventas_detalle vd
        LEFT JOIN public.prendas p ON p.id_prenda=vd.id_prenda
        LEFT JOIN public.tallas t ON t.id_talla=p.id_talla
        LEFT JOIN public.colores co ON co.id_color=p.id_color
        WHERE vd.id_venta=$1 ORDER BY vd.id_detalle`, [ventaId]),
      pool.query('SELECT metodo,monto,referencia FROM public.ventas_pagos WHERE id_venta=$1 ORDER BY id_pago', [ventaId]),
      pool.query(`SELECT estado,fecha_envio FROM public.ventas_ticket_envios
        WHERE id_venta=$1 ORDER BY fecha_envio DESC LIMIT 10`, [ventaId]),
      pool.query(`SELECT vc.fecha_cancelacion,vc.motivo,vc.devolucion_confirmada,
        vc.pagos_originales,uc.nombre AS cancelada_por
        FROM public.ventas_cancelaciones vc
        JOIN public.usuarios uc ON uc.id_usuario=vc.id_usuario
        WHERE vc.id_venta=$1`, [ventaId]),
      pool.query('SELECT nombre_promocion,tipo,descuento_total,unidades_beneficiadas FROM public.ventas_promociones WHERE id_venta=$1 ORDER BY id_venta_promocion', [ventaId]),
    ]);
    return res.json({ ok: true, venta: venta.rows[0], detalles: detalles.rows, pagos: pagos.rows,
      envios: envios.rows, promociones: promociones.rows, cancelacion: cancelaciones.rows[0] || null });
  } catch (e) {
    console.error('historial/detalle', e);
    error(res, 500, 'No se pudo recuperar el detalle de la venta.');
  }
});

module.exports = router;
