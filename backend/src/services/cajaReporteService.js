'use strict';
const { resumenSesion } = require('./cajaCore');

// Todas las ventas del turno se vinculan EXCLUSIVAMENTE por ventas.id_sesion.
// No inferir ni reasignar ventas por horario, sucursal o cajero: eso mezclaría cajas.
async function obtenerReporteCaja(db, idSesion) {
  const info = await resumenSesion(db, idSesion);
  if (!info) return null;

  const [ventasR, movR, pendientesR] = await Promise.all([
    db.query(`
      SELECT v.id_venta, v.folio, v.fecha_venta, v.fecha_cancelacion, v.estado,
        v.total, v.subtotal, v.descuento_total, v.motivo_cancelacion, COALESCE(u.nombre,v.nombre_cajero,'—') AS cajero,
        COALESCE((SELECT string_agg(vp.metodo || ': $' || vp.monto::text,' / ' ORDER BY vp.id_pago)
          FROM public.ventas_pagos vp WHERE vp.id_venta=v.id_venta),'—') AS pagos,
        COALESCE((SELECT string_agg(COALESCE(vd.nombre_prenda,p.nombre,'Prenda') || ' x' || vd.cantidad::text,', ' ORDER BY vd.id_detalle)
          FROM public.ventas_detalle vd LEFT JOIN public.prendas p ON p.id_prenda=vd.id_prenda
          WHERE vd.id_venta=v.id_venta),'—') AS prendas,
        COALESCE((SELECT SUM(vp.monto) FROM public.ventas_pagos vp
          WHERE vp.id_venta=v.id_venta AND vp.metodo='EFECTIVO'),0) AS pago_efectivo,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('metodo',vp.metodo,'monto',vp.monto,'referencia',vp.referencia)
          ORDER BY vp.id_pago) FROM public.ventas_pagos vp WHERE vp.id_venta=v.id_venta),'[]'::jsonb) AS pagos_detalle
      FROM public.ventas v
      LEFT JOIN public.usuarios u ON u.id_usuario=v.id_usuario
      WHERE v.id_sesion=$1 ORDER BY v.fecha_venta ASC,v.id_venta ASC
    `,[idSesion]),
    db.query(`
      SELECT m.id_movimiento,m.fecha_movimiento,m.tipo,m.concepto,m.referencia,m.monto,
        m.observaciones,COALESCE(u.nombre,'—') AS usuario
      FROM public.caja_movimientos m
      LEFT JOIN public.usuarios u ON u.id_usuario=m.id_usuario
      WHERE m.id_sesion=$1 ORDER BY m.fecha_movimiento,m.id_movimiento
    `,[idSesion]),
    db.query(`
      SELECT COUNT(*)::int AS total FROM public.ventas v
      WHERE v.id_sesion IS NULL AND v.id_sucursal=$1
        AND v.fecha_venta >= $2::timestamptz
        AND v.fecha_venta <= COALESCE($3::timestamptz,now())
    `,[info.sesion.id_sucursal,info.sesion.fecha_apertura,info.sesion.fecha_cierre]),
  ]);

  const ventas = ventasR.rows;
  const movimientos = movR.rows;
  const tiposPositivos = new Set(['ENTRADA','AJUSTE_POSITIVO']);
  const actividad = [];
  for (const v of ventas) {
    actividad.push({
      id:`venta-${v.id_venta}`, clase:'VENTA', tipo:'VENTA',
      fecha:v.fecha_venta, folio:v.folio, concepto:v.prendas,
      monto:v.total, importe_signo:1,
      impacto_efectivo:v.pago_efectivo, pagos:v.pagos, estado:v.estado,
      usuario:v.cajero,
    });
    if (v.estado==='CANCELADA') {
      actividad.push({
        id:`cancelacion-${v.id_venta}`,clase:'CANCELACION',tipo:'CANCELACION',
        fecha:v.fecha_cancelacion || v.fecha_venta,folio:v.folio,
        concepto:v.motivo_cancelacion || `Cancelación de ${v.folio}`,
        monto:v.total,importe_signo:-1,
        impacto_efectivo:(-Number(v.pago_efectivo)).toFixed(2),pagos:v.pagos,
        estado:'CANCELADA',usuario:v.cajero,
      });
    }
  }
  for (const m of movimientos) {
    const signo=tiposPositivos.has(m.tipo)?1:-1;
    actividad.push({
      id:`mov-${m.id_movimiento}`,clase:'EFECTIVO',tipo:m.tipo,fecha:m.fecha_movimiento,
      folio:m.referencia || '',concepto:m.concepto,monto:m.monto,importe_signo:signo,
      impacto_efectivo:(signo*Number(m.monto)).toFixed(2),pagos:'EFECTIVO',
      usuario:m.usuario,observaciones:m.observaciones || '',
    });
  }
  actividad.sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)||a.id.localeCompare(b.id));
  return {
    ...info, resumen: {...info.resumen, descuentos_promociones: ventas.filter(v=>v.estado==='COMPLETADA').reduce((total,v)=>total+Number(v.descuento_total||0),0).toFixed(2)}, ventas,movimientos,actividad,
    diagnostico:{ ventas_sin_sesion_en_rango: pendientesR.rows[0]?.total || 0,
      aviso:'Estas ventas NO se atribuyen automáticamente a la caja; verifica su origen antes de corregir datos.' },
  };
}
module.exports={ obtenerReporteCaja };
