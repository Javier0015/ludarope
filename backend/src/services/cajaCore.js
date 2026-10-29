// Operaciones comunes del módulo de caja de LUDAROPE.
// Nunca incluye costos de prendas ni márgenes (ni para administradores).
const enteroId = (v) => {
  const s = String(v ?? '');
  const n = Number(s);
  return /^\d+$/.test(s) && Number.isSafeInteger(n) && n > 0 ? n : null;
};
const aCentavos = (v) => {
  const s = String(v ?? '').trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(s)) return null;
  const [e, d = ''] = s.split('.');
  return Number(e) * 100 + Number((d + '00').slice(0, 2));
};
const monedaSql = (n) => (n / 100).toFixed(2);
const permitirSucursal = (req, sucursal) => req.usuario.rol === 'ADMIN' || Number(req.usuario.id_sucursal) === Number(sucursal);
const permitirSesion = (req, sesion) => Boolean(sesion && (req.usuario.rol === 'ADMIN' || (Number(req.usuario.id_usuario) === Number(sesion.id_usuario) && permitirSucursal(req, sesion.id_sucursal))));
const error = (res, status, mensaje) => res.status(status).json({ ok: false, mensaje });

async function resumenSesion(db, idSesion) {
  const info = await db.query(`
    SELECT se.id_sesion,se.id_caja,se.id_sucursal,se.id_usuario,se.monto_inicial,
      se.fecha_apertura,se.fecha_cierre,se.efectivo_contado,se.efectivo_esperado,
      se.diferencia,se.observaciones,se.conteo_denominaciones,se.estado,
      c.nombre AS caja,s.nombre AS sucursal,u.nombre AS cajero
    FROM caja_sesiones se
    LEFT JOIN cajas c ON c.id_caja=se.id_caja
    JOIN sucursales s ON s.id_sucursal=se.id_sucursal
    JOIN usuarios u ON u.id_usuario=se.id_usuario
    WHERE se.id_sesion=$1
  `, [idSesion]);
  if (!info.rows.length) return null;
  const sesion = info.rows[0];

  const [v, pag, mov] = await Promise.all([
    db.query(`SELECT count(*)::int AS numero_ventas,COALESCE(SUM(total),0) AS total_ventas
      FROM ventas WHERE id_sesion=$1 AND estado='COMPLETADA'`, [idSesion]),
    db.query(`SELECT vp.metodo,COALESCE(SUM(vp.monto),0) AS total
      FROM ventas_pagos vp JOIN ventas v ON v.id_venta=vp.id_venta
      WHERE v.id_sesion=$1 AND v.estado='COMPLETADA' GROUP BY vp.metodo`, [idSesion]),
    db.query(`SELECT tipo,COALESCE(SUM(monto),0) AS total,count(*)::int AS operaciones
      FROM caja_movimientos WHERE id_sesion=$1 GROUP BY tipo`, [idSesion]),
  ]);
  const pagos = Object.fromEntries(['EFECTIVO','DEBITO','CREDITO','TRANSFERENCIA'].map((k) => [k, '0.00']));
  pag.rows.forEach((r) => { pagos[r.metodo] = r.total; });
  const movimientos = Object.fromEntries(['ENTRADA','SALIDA','GASTO','RETIRO','PAGO_PROVEEDOR','AJUSTE_POSITIVO','AJUSTE_NEGATIVO'].map((k) => [k, '0.00']));
  mov.rows.forEach((r) => { movimientos[r.tipo] = r.total; });

  const positivas = ['ENTRADA','AJUSTE_POSITIVO'].reduce((a, t) => a + aCentavos(movimientos[t]), 0);
  const negativas = ['SALIDA','GASTO','RETIRO','PAGO_PROVEEDOR','AJUSTE_NEGATIVO'].reduce((a, t) => a + aCentavos(movimientos[t]), 0);
  const esperadoCentavos = aCentavos(sesion.monto_inicial) + aCentavos(pagos.EFECTIVO) + positivas - negativas;
  const contadoCentavos = sesion.efectivo_contado == null ? null : aCentavos(sesion.efectivo_contado);
  return {
    sesion,
    resumen: {
      numero_ventas: v.rows[0].numero_ventas,
      ventas_total: v.rows[0].total_ventas,
      ventas_efectivo: pagos.EFECTIVO,
      ventas_debito: pagos.DEBITO,
      ventas_credito: pagos.CREDITO,
      ventas_transferencia: pagos.TRANSFERENCIA,
      pagos,
      movimientos,
      entradas_efectivo: monedaSql(positivas),
      salidas_efectivo: monedaSql(negativas),
      efectivo_esperado: monedaSql(esperadoCentavos),
      efectivo_contado: sesion.efectivo_contado,
      diferencia: contadoCentavos === null ? null : monedaSql(contadoCentavos - esperadoCentavos),
    },
  };
}

module.exports = { enteroId, aCentavos, monedaSql, permitirSucursal, permitirSesion, error, resumenSesion };
