const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const pool = require('../config/db');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { generarTicketPdf, enviarTicketPorCorreo } = require('../services/ticketService');
const { cargarPromociones, calcularPromociones } = require('../services/promocionesService');

const router = express.Router();
router.use(verificarToken, autorizarRoles('ADMIN', 'CAJERO'));

const id = (v) => /^\d+$/.test(String(v ?? '')) && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const uuidValido = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ''));
const centavos = (v) => {
  const s = String(v ?? '').trim();
  if (!/^(?:\d{1,9})(?:\.\d{1,2})?$/.test(s)) return null;
  const [e, d = ''] = s.split('.');
  const n = Number(e) * 100 + Number((d + '00').slice(0, 2));
  return Number.isSafeInteger(n) ? n : null;
};
const importe = (c) => (c / 100).toFixed(2);
const errorJson = (res, status, mensaje) => res.status(status).json({ ok: false, mensaje });
const estaAutorizadoSucursal = (req, sucursal) => req.usuario.rol === 'ADMIN' || Number(req.usuario.id_sucursal) === sucursal;
const usuarioId = (req) => Number(req.usuario.id_usuario);
const tiposPago = new Set(['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA']);

// Miniatura histórica del artículo vendido. Guardarla en DB evita que cambie
// o desaparezca al editar/eliminar las fotos del catálogo posteriormente.
const directorioFotos = path.resolve(__dirname, '../../uploads/prendas');
async function fotoHistorica(ruta) {
  if (typeof ruta !== 'string' || !/^\/uploads\/prendas\/[a-zA-Z0-9_-]+\.webp$/.test(ruta)) return null;
  const nombre = path.basename(ruta);
  try {
    const datos = await fs.readFile(path.join(directorioFotos, nombre));
    return await sharp(datos, { limitInputPixels: 40000000 })
      .rotate().resize(340, 340, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 68 }).toBuffer();
  } catch (e) {
    // La venta nunca debe fallar por una foto faltante; el detalle podrá
    // mostrar la foto actual o el icono de "sin fotografía".
    console.warn('Fotografía histórica no disponible:', e.code || e.message);
    return null;
  }
}


function resolverSucursal(req, s) {
  const n = id(s);
  return n && estaAutorizadoSucursal(req, n) ? n : null;
}

router.get('/sucursales', async (req, res) => {
  try {
    const cajero = req.usuario.rol === 'CAJERO';
    const r = await pool.query('SELECT id_sucursal, nombre FROM sucursales WHERE activa = TRUE AND ($1::integer IS NULL OR id_sucursal = $1) ORDER BY nombre', [cajero ? req.usuario.id_sucursal : null]);
    res.json({ ok: true, sucursales: r.rows });
  } catch (e) { console.error('pos/sucursales', e); errorJson(res, 500, 'No se pudieron cargar las sucursales'); }
});

router.get('/prendas', async (req, res) => {
  const sucursal = resolverSucursal(req, req.query.id_sucursal);
  if (!sucursal) return errorJson(res, 403, 'Sucursal no autorizada');
  const buscar = String(req.query.buscar || '').trim().slice(0, 100);
  try {
    const r = await pool.query(`
      SELECT p.id_prenda, p.nombre, p.precio_venta, inv.cantidad AS stock_actual,
        c.nombre AS categoria, t.nombre AS talla, co.nombre AS color,
        'LDR-' || LPAD(p.id_prenda::text, 6, '0') AS codigo, p.codigo_barras,
        (SELECT f.ruta FROM prendas_fotos f WHERE f.id_prenda = p.id_prenda ORDER BY f.orden LIMIT 1) AS foto
      FROM inventario_sucursales inv
      JOIN prendas p ON p.id_prenda = inv.id_prenda
      JOIN categorias c ON c.id_categoria = p.id_categoria
      JOIN tallas t ON t.id_talla = p.id_talla
      JOIN colores co ON co.id_color = p.id_color
      WHERE inv.id_sucursal = $1 AND inv.cantidad > 0 AND p.activa = TRUE
        AND ($2 = '' OR p.nombre ILIKE '%' || $2 || '%' OR c.nombre ILIKE '%' || $2 || '%'
          OR t.nombre ILIKE '%' || $2 || '%' OR co.nombre ILIKE '%' || $2 || '%'
          OR p.codigo_barras ILIKE '%' || $2 || '%'
          OR ('LDR-' || LPAD(p.id_prenda::text, 6, '0')) ILIKE '%' || $2 || '%'
          OR p.id_prenda::text = $2)
      ORDER BY p.id_prenda DESC LIMIT 120
    `, [sucursal, buscar]);
    const reglas = await cargarPromociones(pool,sucursal);
    const prendas = r.rows.map(pr => ({...pr, ofertas: reglas.filter(regla => regla.alcance==='TODAS'
      || regla.alcance==='PRENDAS' && (regla.prendas_ids||[]).map(Number).includes(Number(pr.id_prenda))
      || regla.alcance==='CATEGORIAS' && (regla.categorias_ids||[]).map(Number).includes(Number(pr.id_categoria)))
      .map(regla=>({id_promocion:regla.id_promocion,nombre:regla.nombre,
        etiqueta:regla.tipo==='NXM'?`${regla.lleva_n}×${regla.paga_m}`:regla.tipo==='PORCENTAJE'?`${regla.porcentaje}% OFF`:'Precio especial'})) }));
    res.json({ ok: true, prendas }); // Nunca devolver costos.
  } catch (e) { console.error('pos/prendas', e); errorJson(res, 500, 'No se pudieron consultar las prendas'); }
});

// El POS sólo trabaja con sesiones ligadas a una caja física configurada.
router.get('/sesion', async (req, res) => {
  const sucursal = resolverSucursal(req, req.query.id_sucursal);
  const caja = id(req.query.id_caja);
  if (!sucursal || !caja) return errorJson(res, 400, 'Selecciona una sucursal y una caja.');
  try {
    const r = await pool.query(`SELECT cs.id_sesion,cs.id_sucursal,cs.id_caja,cs.monto_inicial,cs.fecha_apertura,cs.estado
      FROM caja_sesiones cs JOIN cajas c ON c.id_caja=cs.id_caja
      WHERE cs.id_usuario=$1 AND cs.id_sucursal=$2 AND cs.id_caja=$3
        AND c.activo=TRUE AND cs.estado='ABIERTA'
      ORDER BY cs.fecha_apertura DESC LIMIT 1`, [usuarioId(req), sucursal, caja]);
    res.json({ ok: true, sesion: r.rows[0] || null });
  } catch (e) { console.error('pos/sesion', e); errorJson(res, 500, 'No se pudo consultar la sesión de caja'); }
});

// La apertura/cierre viven exclusivamente en /api/caja.
// No permitir rutas anteriores que omiten la identificación de la caja física.
router.post('/sesion/abrir', (_req,res) => errorJson(res, 410, 'Usa /api/caja/abrir con id_caja.'));
router.post('/sesion/cerrar', (_req,res) => errorJson(res, 410, 'Usa /api/caja/cerrar con id_sesion.'));

router.post('/ventas', async (req, res) => {
  const sucursal = resolverSucursal(req, req.body?.id_sucursal);
  const sesion = id(req.body?.id_sesion);
  const clave = req.body?.idempotencia;
  const items = req.body?.items;
  const pagos = req.body?.pagos;
  if (!sucursal || !sesion || !uuidValido(clave) || !Array.isArray(items) || items.length < 1 || items.length > 80 || !Array.isArray(pagos) || pagos.length < 1 || pagos.length > 4) {
    return errorJson(res, 400, 'Venta inválida. Verifica sucursal, caja, prendas y pagos.');
  }

  const agrupados = new Map();
  for (const item of items) {
    const prenda = id(item.id_prenda);
    const cantidad = Number(item.cantidad);
    if (!prenda || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 1000) return errorJson(res, 400, 'Prenda o cantidad inválida');
    agrupados.set(prenda, (agrupados.get(prenda) || 0) + cantidad);
  }
  const ordenados = [...agrupados].sort(([a], [b]) => a - b);
  if (ordenados.some(([, c]) => c > 500) || ordenados.reduce((sum,[,q])=>sum+q,0)>500) return errorJson(res, 400, 'Máximo 500 unidades por operación');

  const medios = new Map();
  for (const p of pagos) {
    if (!tiposPago.has(p.metodo) || medios.has(p.metodo)) return errorJson(res, 400, 'Métodos de pago duplicados o inválidos');
    const monto = centavos(p.monto);
    if (monto === null || monto <= 0) return errorJson(res, 400, 'Importe de pago inválido');
    medios.set(p.metodo, { monto, referencia: String(p.referencia || '').trim().slice(0, 120) || null });
  }
  const recibido = req.body?.monto_recibido === undefined ? 0 : centavos(req.body.monto_recibido);
  if (recibido === null || recibido < 0 || (medios.has('EFECTIVO') ? recibido < medios.get('EFECTIVO').monto : recibido !== 0)) {
    return errorJson(res, 400, 'Efectivo recibido inválido');
  }
  const client = await pool.connect();
  let transaccionAbierta = false;
  try {
    await client.query('BEGIN'); transaccionAbierta = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    const repetida = await client.query(`SELECT id_venta,folio,total,fecha_venta,estado FROM ventas WHERE idempotencia=$1 AND id_usuario=$2`, [clave, usuarioId(req)]);
    if (repetida.rowCount) {
      await client.query('ROLLBACK'); transaccionAbierta = false;
      if (repetida.rows[0].estado !== 'COMPLETADA') return errorJson(res, 409, 'La venta anterior fue cancelada. Inicia un cobro nuevo.');
      return res.json({ ok: true, venta: repetida.rows[0], repetida: true });
    }
    const caja = await client.query(`SELECT cs.id_sesion FROM caja_sesiones cs
      JOIN cajas c ON c.id_caja=cs.id_caja
      WHERE cs.id_sesion=$1 AND cs.id_sucursal=$2
      AND cs.id_usuario=$3 AND cs.estado='ABIERTA' AND c.activo=TRUE
      AND ($4::boolean=TRUE OR c.id_usuario_asignado=$3)
      FOR SHARE OF cs`, [sesion, sucursal, usuarioId(req), req.usuario.rol==='ADMIN']);
    if (!caja.rowCount) { await client.query('ROLLBACK'); transaccionAbierta = false; return errorJson(res, 409, 'Primero abre tu caja para cobrar'); }

    const datos = [];
    let totalCentavos = 0;
    for (const [idPrenda, cantidad] of ordenados) {
      const r = await client.query(`SELECT p.id_prenda,p.nombre,p.id_categoria,p.precio_venta,c.nombre AS categoria,
        t.nombre AS talla,co.nombre AS color,i.cantidad AS stock_actual,pc.costo_unitario,
        (SELECT COALESCE(json_agg(f.ruta ORDER BY f.orden,f.id_foto),'[]'::json)
          FROM prendas_fotos f WHERE f.id_prenda=p.id_prenda) AS fotos_actuales
        FROM inventario_sucursales i JOIN prendas p ON p.id_prenda=i.id_prenda
        JOIN categorias c ON c.id_categoria=p.id_categoria
        JOIN tallas t ON t.id_talla=p.id_talla
        JOIN colores co ON co.id_color=p.id_color
        LEFT JOIN prendas_costos pc ON pc.id_prenda=p.id_prenda
        WHERE i.id_prenda=$1 AND i.id_sucursal=$2 AND p.activa=TRUE
        FOR UPDATE OF i`, [idPrenda, sucursal]);
      if (!r.rowCount || r.rows[0].stock_actual < cantidad) {
        await client.query('ROLLBACK'); transaccionAbierta = false;
        return errorJson(res, 409, `Existencias insuficientes para la prenda ${idPrenda}. Actualiza el inventario.`);
      }
      const fila = r.rows[0];
      const precio = centavos(fila.precio_venta);
      if (precio === null || precio <= 0) throw new Error('Precio inválido en inventario');
      const importeLinea = precio * cantidad;
      if (!Number.isSafeInteger(importeLinea)) throw new Error('Importe excesivo');
      totalCentavos += importeLinea;
      datos.push({ ...fila, cantidad, precio, importeLinea });
    }
    if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0) throw new Error('Total inválido');
    const promocionesVigentes = await cargarPromociones(client, sucursal, {lock:true});
    const promocion = calcularPromociones(datos.map(d=>({id_prenda:d.id_prenda,id_categoria:d.id_categoria,precio_venta:importe(d.precio),cantidad:d.cantidad})), promocionesVigentes);
    totalCentavos = promocion.total_centavos;
    if (totalCentavos <= 0) { await client.query('ROLLBACK'); transaccionAbierta = false; return errorJson(res,409,'El total queda en cero; revisa la promoción antes de cobrar.'); }
    const pagado = [...medios.values()].reduce((a, v) => a + v.monto, 0);
    if (pagado !== totalCentavos) {
      await client.query('ROLLBACK'); transaccionAbierta = false;
      return errorJson(res, 409, `El total actual es ${importe(totalCentavos)}. Actualiza el carrito y los pagos.`);
    }
    const efectivoAplicado = medios.get('EFECTIVO')?.monto || 0;
    const cambio = efectivoAplicado ? recibido - efectivoAplicado : 0;
    const suc = await client.query('SELECT nombre,direccion FROM sucursales WHERE id_sucursal=$1 AND activa=TRUE', [sucursal]);
    if (!suc.rowCount) throw new Error('Sucursal inactiva');
    const usu = await client.query('SELECT nombre FROM usuarios WHERE id_usuario=$1', [usuarioId(req)]);
    const venta = await client.query(`INSERT INTO ventas
      (id_sucursal,id_usuario,id_sesion,subtotal,descuento_total,total,nombre_sucursal,direccion_sucursal,nombre_cajero,monto_recibido,cambio,idempotencia)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id_venta,folio,total,fecha_venta`, [sucursal, usuarioId(req), sesion, promocion.subtotal, promocion.descuento_total, promocion.total,
      suc.rows[0].nombre, suc.rows[0].direccion, usu.rows[0]?.nombre || 'Personal', importe(recibido), importe(cambio), clave]);
    const idVenta = venta.rows[0].id_venta;
    for (const d of datos) {
      const linea = promocion.lineas.find(l=>Number(l.id_prenda)===Number(d.id_prenda));
      const imagenesHistoricas = [];
      for (const ruta of (Array.isArray(d.fotos_actuales) ? d.fotos_actuales : []).slice(0, 4)) {
        const miniatura = await fotoHistorica(ruta);
        if (miniatura) imagenesHistoricas.push(miniatura.toString('base64'));
      }
      await client.query(`INSERT INTO ventas_detalle
        (id_venta,id_prenda,cantidad,precio_lista,precio_unitario,descuento,total_linea,costo_unitario_venta,nombre_prenda,talla,color,fotos_venta,promociones_snapshot)
        VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
      [idVenta, d.id_prenda, d.cantidad, importe(d.precio), importe(linea.descuento_centavos), importe(linea.total_centavos), d.costo_unitario, d.nombre, d.talla, d.color, JSON.stringify(imagenesHistoricas), JSON.stringify(linea.promociones)]);
      await client.query(`UPDATE inventario_sucursales SET cantidad=cantidad-$3,fecha_actualizacion=now()
        WHERE id_prenda=$1 AND id_sucursal=$2`, [d.id_prenda, sucursal, d.cantidad]);
      await client.query(`INSERT INTO inventario_movimientos
        (id_prenda,id_sucursal,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo,observaciones)
        VALUES($1,$2,$3,'VENTA',$4,$5,$6,$7)`,
      [d.id_prenda, sucursal, usuarioId(req), d.cantidad, d.stock_actual, d.stock_actual - d.cantidad, `Venta ${venta.rows[0].folio}`]);
    }
    for (const pr of promocion.promociones) {
      await client.query(`INSERT INTO ventas_promociones(id_venta,id_promocion,nombre_promocion,tipo,descuento_total,unidades_beneficiadas,regla_historica)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,[idVenta,pr.id_promocion,pr.nombre,pr.tipo,pr.descuento,pr.unidades_beneficiadas,JSON.stringify(pr.regla)]);
    }
    for (const [metodo, pago] of medios) {
      await client.query(`INSERT INTO ventas_pagos(id_venta,metodo,monto,referencia) VALUES($1,$2,$3,$4)`,
        [idVenta, metodo, importe(pago.monto), pago.referencia]);
    }
    await client.query('COMMIT'); transaccionAbierta = false;
    res.status(201).json({ ok: true, venta: { ...venta.rows[0], cambio: importe(cambio), descuento_total:promocion.descuento_total, promociones:promocion.promociones } });
  } catch (e) {
    if (transaccionAbierta) await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') {
      const r = await pool.query('SELECT id_venta,folio,total,fecha_venta,estado FROM ventas WHERE idempotencia=$1 AND id_usuario=$2', [clave, usuarioId(req)]).catch(() => ({ rows: [] }));
      if (r.rows[0]) {
        if (r.rows[0].estado !== 'COMPLETADA') return errorJson(res, 409, 'La venta anterior fue cancelada. Inicia un cobro nuevo.');
        return res.json({ ok: true, venta: r.rows[0], repetida: true });
      }
    }
    console.error('pos/ventas', e);
    errorJson(res, e.code === '55P03' ? 409 : 500, e.code === '55P03' ? 'Inventario ocupado, intenta de nuevo' : 'No fue posible registrar la venta');
  } finally { client.release(); }
});

router.get('/ventas', async (req, res) => {
  const sucursal = resolverSucursal(req, req.query.id_sucursal);
  if (!sucursal) return errorJson(res, 403, 'Sucursal no autorizada');
  try {
    const r = await pool.query(`SELECT id_venta,folio,fecha_venta,total,nombre_sucursal,estado
      FROM ventas WHERE id_sucursal=$1 AND estado='COMPLETADA'
        AND ($2::boolean = TRUE OR id_usuario=$3)
      ORDER BY fecha_venta DESC LIMIT 15`, [sucursal, req.usuario.rol === 'ADMIN', usuarioId(req)]);
    res.json({ ok: true, ventas: r.rows });
  } catch (e) { console.error('pos/historial', e); errorJson(res, 500, 'No se pudo consultar el historial'); }
});

// Acceso a los datos históricos sin exponer costo_unitario_venta.
async function cargarTicket(req, idVenta) {
  const resultado = await pool.query(`SELECT v.id_venta,v.folio,v.fecha_venta,v.subtotal,v.descuento_total,v.total,
    v.nombre_sucursal,v.direccion_sucursal,v.nombre_cajero,v.monto_recibido,v.cambio,
    v.id_sucursal,v.id_usuario,v.estado
    FROM ventas v WHERE v.id_venta=$1`, [idVenta]);
  const venta = resultado.rows[0];
  if (!venta || (req.usuario.rol !== 'ADMIN' && (venta.id_sucursal !== Number(req.usuario.id_sucursal)))) return null;
  const det = await pool.query(`SELECT id_prenda,cantidad,precio_unitario,descuento,total_linea,nombre_prenda,talla,color,promociones_snapshot
    FROM ventas_detalle WHERE id_venta=$1 ORDER BY id_detalle`, [idVenta]);
  const pag = await pool.query('SELECT metodo,monto FROM ventas_pagos WHERE id_venta=$1 ORDER BY id_pago', [idVenta]);
  return { venta, detalles: det.rows, pagos: pag.rows };
}

router.get('/ventas/:id/ticket.pdf', async (req, res) => {
  const ventaId = id(req.params.id);
  if (!ventaId) return errorJson(res, 400, 'Folio inválido');
  try {
    const ticket = await cargarTicket(req, ventaId);
    if (!ticket) return errorJson(res, 404, 'Comprobante no encontrado');
    if (ticket.venta.estado !== 'COMPLETADA') return errorJson(res, 409, 'Venta cancelada. No puede emitirse un comprobante vigente.');
    const pdf = await generarTicketPdf(ticket);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${ticket.venta.folio}.pdf"`, 'Cache-Control': 'private, no-store', 'Content-Length': pdf.length });
    res.send(pdf);
  } catch (e) { console.error('pos/ticket.pdf', e); errorJson(res, 500, 'No se pudo crear el comprobante'); }
});

router.post('/ventas/:id/enviar-ticket', async (req, res) => {
  const ventaId = id(req.params.id);
  const correo = String(req.body?.correo || '').trim().toLowerCase();
  if (!ventaId || correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return errorJson(res, 400, 'Ingresa un correo válido');
  try {
    const ticket = await cargarTicket(req, ventaId);
    if (!ticket) return errorJson(res, 404, 'Venta no encontrada');
    if (ticket.venta.estado !== 'COMPLETADA') return errorJson(res, 409, 'Venta cancelada. No puede enviarse un comprobante vigente.');
    const r = await pool.query(`SELECT 1 FROM ventas_ticket_envios WHERE id_venta=$1 AND id_usuario=$2
      AND fecha_envio > now()-interval '30 seconds' LIMIT 1`, [ventaId, usuarioId(req)]);
    if (r.rowCount) return errorJson(res, 429, 'Espera unos segundos antes de reenviar');
    const pdf = await generarTicketPdf(ticket);
    try {
      await enviarTicketPorCorreo({ correo, venta: ticket.venta, pdf });
      await pool.query(`INSERT INTO ventas_ticket_envios(id_venta,id_usuario,correo_destino,estado) VALUES ($1,$2,$3,'ENVIADO')`, [ventaId, usuarioId(req), correo]);
      res.json({ ok: true, mensaje: 'Comprobante enviado por correo' });
    } catch (e) {
      await pool.query(`INSERT INTO ventas_ticket_envios(id_venta,id_usuario,correo_destino,estado,detalle_error) VALUES ($1,$2,$3,'ERROR',$4)`,
        [ventaId, usuarioId(req), correo, String(e.code || 'SMTP_ERROR').slice(0, 300)]).catch(() => {});
      console.error('pos/email', e.code || e.message);
      errorJson(res, e.code === 'SMTP_UNCONFIGURED' ? 503 : 502, 'La venta está registrada, pero no se pudo enviar el correo. Verifica la configuración SMTP o reintenta.');
    }
  } catch (e) { console.error('pos/enviar-ticket', e); errorJson(res, 500, 'No se pudo procesar el envío'); }
});

module.exports = router;
