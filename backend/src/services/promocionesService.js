'use strict';
// Motor común para simulación y cobro. Todos los importes son centavos enteros.
const CODIGOS = new Set(['PORCENTAJE','PRECIO_ESPECIAL','NXM']);

async function cargarPromociones(db, sucursal, { vigentes = true, lock = false } = {}) {
  const r = await db.query(`SELECT p.*,
    ARRAY(SELECT pp.id_prenda FROM public.promociones_prendas pp WHERE pp.id_promocion=p.id_promocion) AS prendas_ids,
    ARRAY(SELECT pc.id_categoria FROM public.promociones_categorias pc WHERE pc.id_promocion=p.id_promocion) AS categorias_ids,
    ARRAY(SELECT ps.id_sucursal FROM public.promociones_sucursales ps WHERE ps.id_promocion=p.id_promocion) AS sucursales_ids
    FROM public.promociones p
    WHERE p.activa = TRUE
      AND ($2::boolean = FALSE OR (p.fecha_inicio <= now() AND p.fecha_fin > now()))
      AND (NOT EXISTS(SELECT 1 FROM public.promociones_sucursales x WHERE x.id_promocion=p.id_promocion)
        OR EXISTS(SELECT 1 FROM public.promociones_sucursales x WHERE x.id_promocion=p.id_promocion AND x.id_sucursal=$1))
    ORDER BY p.prioridad DESC, p.id_promocion ASC ${lock ? 'FOR SHARE OF p' : ''}`,
    [sucursal, vigentes]);
  return r.rows;
}

function centavos(valor) {
  const s = String(valor ?? '').trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(s)) return null;
  const [e, d = ''] = s.split('.');
  const n = Number(e) * 100 + Number((d + '00').slice(0, 2));
  return Number.isSafeInteger(n) ? n : null;
}
function dinero(v) { return (v / 100).toFixed(2); }

// datos: {id_prenda,id_categoria,precio_venta,cantidad}. Una promoción por UNIDAD.
function calcularPromociones(datos, promociones) {
  const unidades = [];
  for (let i = 0; i < datos.length; i++) {
    const d = datos[i];
    const precio = centavos(d.precio_venta);
    if (!precio || !Number.isInteger(d.cantidad) || d.cantidad <= 0) throw Error('Prendas o precios inválidos');
    if (unidades.length + d.cantidad > 500) throw Error('Máximo 500 unidades por operación');
    for (let k = 0; k < d.cantidad; k++) unidades.push({ idx: i, id_prenda: Number(d.id_prenda), id_categoria: Number(d.id_categoria), precio, descuento: 0, usada: false, promo: null });
  }
  const activas = promociones.filter(p => CODIGOS.has(p.tipo))
    .sort((a, b) => Number(b.prioridad) - Number(a.prioridad) || Number(a.id_promocion) - Number(b.id_promocion));
  const aplicadas = new Map();
  function guardar(p, grupo, descuentos) {
    if (!descuentos.some(d => d > 0)) return;
    let item = aplicadas.get(String(p.id_promocion));
    if (!item) {
      item = { id_promocion: Number(p.id_promocion), nombre: p.nombre, tipo: p.tipo,
        descuento_centavos: 0, unidades_beneficiadas: 0, regla: { tipo: p.tipo, porcentaje: p.porcentaje, precio_especial: p.precio_especial, lleva_n: p.lleva_n, paga_m: p.paga_m } };
      aplicadas.set(String(p.id_promocion), item);
    }
    for (let i = 0; i < grupo.length; i++) {
      grupo[i].usada = true; groupDiscount(grupo[i], descuentos[i], p);
      item.descuento_centavos += descuentos[i];
      if (descuentos[i] > 0) item.unidades_beneficiadas++;
    }
  }
  function groupDiscount(u, valor, p) { u.descuento = valor; u.promo = { id_promocion: Number(p.id_promocion), nombre: p.nombre, tipo: p.tipo }; }
  const elegible = (u, p) => {
    if (u.usada) return false;
    if (p.alcance === 'TODAS') return true;
    if (p.alcance === 'PRENDAS') return (p.prendas_ids || []).map(Number).includes(u.id_prenda);
    if (p.alcance === 'CATEGORIAS') return (p.categorias_ids || []).map(Number).includes(u.id_categoria);
    return false;
  };
  for (const p of activas) {
    const candidatos = unidades.filter(u => elegible(u, p)).sort((a,b) => b.precio-a.precio || a.id_prenda-b.id_prenda);
    if (p.tipo === 'PORCENTAJE') {
      const porcentaje = Number(p.porcentaje);
      if (!(porcentaje > 0 && porcentaje <= 100)) continue;
      for (const u of candidatos) { const desc = Math.min(u.precio, Math.round(u.precio * porcentaje / 100)); guardar(p, [u], [desc]); }
    } else if (p.tipo === 'PRECIO_ESPECIAL') {
      const fijo = centavos(p.precio_especial);
      if (fijo === null || fijo < 1) continue;
      for (const u of candidatos) if (u.precio > fijo) guardar(p, [u], [u.precio - fijo]);
    } else if (p.tipo === 'NXM') {
      const n = Number(p.lleva_n), m = Number(p.paga_m);
      if (!Number.isInteger(n) || !Number.isInteger(m) || n < 2 || n > 20 || m < 1 || m >= n) continue;
      const grupos = p.combinar_prendas === false
        ? [...new Set(candidatos.map(u => u.id_prenda))].map(id => candidatos.filter(u => u.id_prenda === id))
        : [candidatos];
      for (const disponibles of grupos) {
        // Primero los de mayor precio. En cada grupo de N, las N-M más baratas son gratis.
        for (let i = 0; i + n <= disponibles.length; i += n) {
          const grupo = disponibles.slice(i, i+n);
          guardar(p, grupo, grupo.map((u, k) => k >= m ? u.precio : 0));
        }
      }
    }
  }
  const lineas = datos.map((d, idx) => {
    const uni = unidades.filter(u => u.idx === idx);
    const subtotal = uni.reduce((s,u) => s+u.precio,0);
    const descuento = uni.reduce((s,u) => s+u.descuento,0);
    const promociones_linea = [...new Map(uni.filter(u => u.descuento && u.promo).map(u => [u.promo.id_promocion, u.promo])).values()];
    return { id_prenda: Number(d.id_prenda), cantidad: d.cantidad, precio_unitario: dinero(uni[0].precio),
      subtotal_centavos: subtotal, descuento_centavos: descuento, total_centavos: subtotal-descuento, promociones: promociones_linea };
  });
  const subtotal_centavos = lineas.reduce((s,d)=>s+d.subtotal_centavos,0);
  const descuento_centavos = lineas.reduce((s,d)=>s+d.descuento_centavos,0);
  return { subtotal_centavos, descuento_centavos, total_centavos: subtotal_centavos - descuento_centavos,
    subtotal: dinero(subtotal_centavos), descuento_total: dinero(descuento_centavos), total: dinero(subtotal_centavos-descuento_centavos),
    lineas, promociones: [...aplicadas.values()].map(p => ({ ...p, descuento: dinero(p.descuento_centavos) })) };
}
module.exports = { cargarPromociones, calcularPromociones, centavos, dinero };
