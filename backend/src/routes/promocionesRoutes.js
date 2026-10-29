'use strict';
const express = require('express');
const pool = require('../config/db');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { cargarPromociones, calcularPromociones } = require('../services/promocionesService');
const router = express.Router();
router.use(verificarToken);
const fail = (res, status, mensaje) => res.status(status).json({ ok:false, mensaje });
const id = v => /^\d+$/.test(String(v ?? '')) && Number.isSafeInteger(Number(v)) && Number(v)>0 ? Number(v) : null;
function listaIds(v) {
  if (!Array.isArray(v) || v.length > 200) return null;
  const a = v.map(id);
  return a.every(Boolean) ? [...new Set(a)] : null;
}
async function catalogos(db) {
  const [prendas,categorias,sucursales] = await Promise.all([
    db.query('SELECT id_prenda,nombre,precio_venta FROM prendas WHERE activa=TRUE ORDER BY nombre'),
    db.query('SELECT id_categoria,nombre FROM categorias WHERE activo=TRUE ORDER BY nombre'),
    db.query('SELECT id_sucursal,nombre FROM sucursales WHERE activa=TRUE ORDER BY nombre'),
  ]);
  return { prendas: prendas.rows, categorias: categorias.rows, sucursales: sucursales.rows };
}
// Preview: autoritativa para precios de inventario en este instante, pero no reserva stock ni precio.
router.post('/simular', autorizarRoles('ADMIN','CAJERO'), async (req,res) => {
  const sucursal = id(req.body?.id_sucursal);
  const items = req.body?.items;
  if (!sucursal || (req.usuario.rol==='CAJERO' && sucursal!==Number(req.usuario.id_sucursal)) || !Array.isArray(items) || !items.length || items.length>80)
    return fail(res,400,'Sucursal o carrito inválido.');
  const cantidades = new Map();
  for (const x of items) {
    const prenda = id(x.id_prenda), cantidad = Number(x.cantidad);
    if (!prenda || !Number.isSafeInteger(cantidad) || cantidad<1 || cantidad>500) return fail(res,400,'Cantidad inválida.');
    cantidades.set(prenda,(cantidades.get(prenda)||0)+cantidad);
  }
  if ([...cantidades.values()].reduce((a,b)=>a+b,0)>500) return fail(res,400,'Máximo 500 unidades.');
  try {
    const ids = [...cantidades.keys()];
    const datos = await pool.query(`SELECT p.id_prenda,p.id_categoria,p.precio_venta,i.cantidad AS stock
      FROM public.prendas p JOIN public.inventario_sucursales i ON i.id_prenda=p.id_prenda
      WHERE i.id_sucursal=$1 AND p.activa=TRUE AND p.id_prenda=ANY($2::integer[])`,[sucursal,ids]);
    if (datos.rowCount!==ids.length || datos.rows.some(d=>Number(d.stock)<cantidades.get(Number(d.id_prenda))))
      return fail(res,409,'El carrito cambió o no hay suficientes existencias.');
    const reglas = await cargarPromociones(pool,sucursal);
    const resultado = calcularPromociones(datos.rows.map(d=>({...d,cantidad:cantidades.get(Number(d.id_prenda))})),reglas);
    res.json({ok:true,...resultado});
  } catch(e) { console.error('simular promociones',e); fail(res,500,'No se pudieron calcular los descuentos.'); }
});
router.use(autorizarRoles('ADMIN'));
router.get('/opciones', async(_req,res)=>{
  try {res.json({ok:true,...await catalogos(pool)});}catch(e){console.error(e);fail(res,500,'Error en catálogos.');}
});
router.get('/',async(_req,res)=>{
  try {
    const r=await pool.query(`SELECT p.*,
      ARRAY(SELECT pp.id_prenda FROM promociones_prendas pp WHERE pp.id_promocion=p.id_promocion) AS prendas_ids,
      ARRAY(SELECT pc.id_categoria FROM promociones_categorias pc WHERE pc.id_promocion=p.id_promocion) AS categorias_ids,
      ARRAY(SELECT ps.id_sucursal FROM promociones_sucursales ps WHERE ps.id_promocion=p.id_promocion) AS sucursales_ids
      FROM promociones p ORDER BY p.fecha_creacion DESC LIMIT 300`);
    res.json({ok:true,promociones:r.rows});
  }catch(e){console.error(e);fail(res,500,'No se pudieron consultar promociones.');}
});
function validar(datos) {
  const nombre=String(datos?.nombre||'').trim();
  const descripcion=String(datos?.descripcion||'').trim();
  const tipo=String(datos?.tipo||'');
  const alcance=String(datos?.alcance||'');
  const prendas=listaIds(datos?.prendas_ids||[]), categorias=listaIds(datos?.categorias_ids||[]), sucursales=listaIds(datos?.sucursales_ids||[]);
  const inicio=new Date(datos?.fecha_inicio),fin=new Date(datos?.fecha_fin);
  if (!nombre || nombre.length>140 || descripcion.length>500 || !['PORCENTAJE','PRECIO_ESPECIAL','NXM'].includes(tipo) || !['TODAS','PRENDAS','CATEGORIAS'].includes(alcance)) return null;
  if (!prendas || !categorias || !sucursales || (alcance==='PRENDAS'&&!prendas.length) || (alcance==='CATEGORIAS'&&!categorias.length)) return null;
  if (!Number.isFinite(+inicio) || !Number.isFinite(+fin) || inicio>=fin) return null;
  const porcentaje=tipo==='PORCENTAJE'?Number(datos.porcentaje):null;
  const precio=tipo==='PRECIO_ESPECIAL'?Number(datos.precio_especial):null;
  const lleva=tipo==='NXM'?Number(datos.lleva_n):null,paga=tipo==='NXM'?Number(datos.paga_m):null;
  if ((tipo==='PORCENTAJE'&&!(porcentaje>0&&porcentaje<100)) ||
    (tipo==='PRECIO_ESPECIAL'&&!(Number.isFinite(precio)&&precio>0&&precio<=999999999&&Math.abs(precio*100-Math.round(precio*100))<1e-6)) ||
    (tipo==='NXM'&&(!Number.isInteger(lleva)||!Number.isInteger(paga)||lleva<2||lleva>20||paga<1||paga>=lleva))) return null;
  const prioridad=Number(datos.prioridad||0);
  if (!Number.isInteger(prioridad)||Math.abs(prioridad)>10000) return null;
  return {nombre,descripcion,tipo,alcance,porcentaje,precio,lleva,paga,
    combinar:datos.combinar_prendas!==false,prioridad,inicio:inicio.toISOString(),fin:fin.toISOString(),activa:datos.activa!==false,
    prendas:alcance==='PRENDAS'?prendas:[],categorias:alcance==='CATEGORIAS'?categorias:[],sucursales};
}
async function guardar(req,res,existente) {
  const obj=validar(req.body);
  if (!obj) return fail(res,400,'Revisa nombre, vigencia, reglas y selección de prendas o categorías.');
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    let promo;
    const campos=[obj.nombre,obj.descripcion,obj.tipo,obj.alcance,obj.porcentaje,obj.precio,obj.lleva,obj.paga,obj.combinar,obj.prioridad,obj.inicio,obj.fin,obj.activa];
    if (existente) {
      const r=await db.query(`UPDATE promociones SET
        nombre=$2,descripcion=$3,tipo=$4,alcance=$5,porcentaje=$6,precio_especial=$7,lleva_n=$8,paga_m=$9,
        combinar_prendas=$10,prioridad=$11,fecha_inicio=$12,fecha_fin=$13,activa=$14,fecha_actualizacion=now()
        WHERE id_promocion=$1 RETURNING id_promocion`,[existente,...campos]);
      if (!r.rowCount) {await db.query('ROLLBACK');return fail(res,404,'Promoción no encontrada.');}
      promo=existente;
      for (const t of ['promociones_prendas','promociones_categorias','promociones_sucursales']) await db.query(`DELETE FROM ${t} WHERE id_promocion=$1`,[promo]);
    } else {
      const r=await db.query(`INSERT INTO promociones (nombre,descripcion,tipo,alcance,porcentaje,precio_especial,lleva_n,paga_m,combinar_prendas,prioridad,fecha_inicio,fecha_fin,activa,creada_por)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id_promocion`,[...campos,req.usuario.id_usuario]);
      promo=r.rows[0].id_promocion;
    }
    for (const [tabla,clave,arr] of [['promociones_prendas','id_prenda',obj.prendas],['promociones_categorias','id_categoria',obj.categorias],['promociones_sucursales','id_sucursal',obj.sucursales]]) {
      for (const n of arr) await db.query(`INSERT INTO ${tabla}(id_promocion,${clave}) VALUES($1,$2)`,[promo,n]);
    }
    await db.query('COMMIT');res.json({ok:true,id_promocion:promo});
  }catch(e){await db.query('ROLLBACK').catch(()=>{});console.error('guardar promoción',e);fail(res,e.code==='23503'?409:500,e.code==='23503'?'Una prenda, categoría o sucursal ya no existe.':'No se pudo guardar la promoción.');}
  finally{db.release();}
}
router.post('/',(req,res)=>guardar(req,res,null));
router.put('/:id',(req,res)=>{const x=id(req.params.id);if(!x)return fail(res,400,'ID inválido');return guardar(req,res,x);});
router.patch('/:id/estado',async(req,res)=>{
  const x=id(req.params.id);if(!x||typeof req.body?.activa!=='boolean')return fail(res,400,'Solicitud inválida.');
  try{const r=await pool.query('UPDATE promociones SET activa=$2,fecha_actualizacion=now() WHERE id_promocion=$1 RETURNING id_promocion',[x,req.body.activa]);if(!r.rowCount)return fail(res,404,'Promoción inexistente.');res.json({ok:true});}
  catch(e){console.error(e);fail(res,500,'No se pudo cambiar el estado.');}
});
module.exports=router;
