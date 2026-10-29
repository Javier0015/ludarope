const express = require('express');
const pool = require('../config/db');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { enteroId, error } = require('../services/cajaCore');
const router = express.Router();
router.use(verificarToken, autorizarRoles('ADMIN'));

async function validarAsignacion(client, idUsuario, idSucursal, cajaActual = null) {
  if (!idUsuario) return null;
  const r = await client.query(`
    SELECT id_usuario FROM usuarios WHERE id_usuario=$1 AND id_sucursal=$2
      AND rol='CAJERO' AND activo=TRUE`, [idUsuario, idSucursal]);
  if (!r.rowCount) return 'El cajero no está activo o no pertenece a esa sucursal.';
  const ocupado = await client.query(`SELECT id_caja FROM cajas WHERE id_usuario_asignado=$1 AND activo=TRUE AND ($2::int IS NULL OR id_caja<>$2)`, [idUsuario, cajaActual]);
  if (ocupado.rowCount) return 'Este cajero ya tiene una caja activa asignada.';
  return null;
}

router.get('/cajeros', async (req, res) => {
  const sucursal = enteroId(req.query.id_sucursal || req.query.sucursal);
  if (!sucursal) return error(res, 400, 'Selecciona una sucursal.');
  try {
    const r = await pool.query(`SELECT u.id_usuario,u.nombre,u.usuario,c.id_caja AS caja_asignada
      FROM usuarios u LEFT JOIN cajas c ON c.id_usuario_asignado=u.id_usuario AND c.activo=TRUE
      WHERE u.rol='CAJERO' AND u.activo=TRUE AND u.id_sucursal=$1 ORDER BY u.nombre`, [sucursal]);
    res.json({ ok: true, cajeros: r.rows });
  } catch (e) { console.error('admin/cajas/cajeros', e); error(res, 500, 'No fue posible consultar cajeros.'); }
});

router.get('/', async (req, res) => {
  const sucursal = req.query.id_sucursal || req.query.sucursal;
  const filtro = sucursal ? enteroId(sucursal) : null;
  if (sucursal && !filtro) return error(res, 400, 'Sucursal inválida.');
  const buscar = String(req.query.buscar || '').trim().slice(0, 100);
  try {
    const r = await pool.query(`SELECT c.id_caja,c.id_sucursal,c.nombre,c.descripcion,c.id_usuario_asignado,
      c.activo,c.fecha_creacion,c.fecha_actualizacion,s.nombre AS sucursal,
      u.nombre AS cajero_asignado, se.id_sesion AS sesion_abierta,se.id_usuario AS operando_por
      FROM cajas c JOIN sucursales s ON s.id_sucursal=c.id_sucursal
      LEFT JOIN usuarios u ON u.id_usuario=c.id_usuario_asignado
      LEFT JOIN caja_sesiones se ON se.id_caja=c.id_caja AND se.estado='ABIERTA'
      WHERE ($1::int IS NULL OR c.id_sucursal=$1)
      AND ($2='' OR c.nombre ILIKE '%'||$2||'%' OR COALESCE(c.descripcion,'') ILIKE '%'||$2||'%'
         OR s.nombre ILIKE '%'||$2||'%' OR COALESCE(u.nombre,'') ILIKE '%'||$2||'%')
      ORDER BY s.nombre,c.nombre`, [filtro, buscar]);
    res.json({ ok: true, cajas: r.rows });
  } catch (e) { console.error('admin/cajas', e); error(res, 500, 'No fue posible consultar las cajas.'); }
});

router.post('/', async (req, res) => {
  const sucursal = enteroId(req.body?.id_sucursal);
  const nombre = String(req.body?.nombre || '').trim();
  const descripcion = String(req.body?.descripcion || '').trim();
  const asignado = req.body?.id_usuario_asignado ? enteroId(req.body.id_usuario_asignado) : null;
  if (!sucursal || !nombre || nombre.length > 100 || descripcion.length > 250 || (req.body?.id_usuario_asignado && !asignado)) return error(res, 400, 'Revisa nombre, sucursal y cajero.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const s = await client.query('SELECT 1 FROM sucursales WHERE id_sucursal=$1 AND activa=TRUE', [sucursal]);
    if (!s.rowCount) { await client.query('ROLLBACK'); return error(res, 400, 'Sucursal inactiva o inexistente.'); }
    const falla = await validarAsignacion(client, asignado, sucursal);
    if (falla) { await client.query('ROLLBACK'); return error(res, 409, falla); }
    const r = await client.query(`INSERT INTO cajas(id_sucursal,nombre,descripcion,id_usuario_asignado,activo)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [sucursal,nombre,descripcion || null,asignado,req.body?.activo !== false]);
    await client.query('COMMIT');
    res.status(201).json({ ok:true,caja:r.rows[0],mensaje:'Caja registrada.' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') return error(res, 409, 'Ya existe ese nombre de caja o el cajero ya está asignado.');
    console.error('admin/cajas/post',e); error(res,500,'No fue posible guardar la caja.');
  } finally { client.release(); }
});

router.put('/:id', async (req,res) => {
  const cajaId = enteroId(req.params.id);
  const nombre = String(req.body?.nombre || '').trim();
  const descripcion = String(req.body?.descripcion || '').trim();
  const sucursal = enteroId(req.body?.id_sucursal);
  const asignado = req.body?.id_usuario_asignado ? enteroId(req.body.id_usuario_asignado) : null;
  const activo = req.body?.activo !== false;
  if (!cajaId || !sucursal || !nombre || nombre.length>100 || descripcion.length>250 || (req.body?.id_usuario_asignado && !asignado)) return error(res,400,'Datos de caja inválidos.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const original = await client.query('SELECT * FROM cajas WHERE id_caja=$1 FOR UPDATE',[cajaId]);
    if (!original.rowCount) { await client.query('ROLLBACK'); return error(res,404,'Caja no encontrada.'); }
    if (original.rows[0].id_sucursal !== sucursal) { await client.query('ROLLBACK'); return error(res,409,'No se puede mover una caja a otra sucursal. Crea otra caja.'); }
    const abierta = await client.query('SELECT 1 FROM caja_sesiones WHERE id_caja=$1 AND estado=\'ABIERTA\'',[cajaId]);
    if (abierta.rowCount && (!activo || Number(original.rows[0].id_usuario_asignado) !== Number(asignado))) {
      await client.query('ROLLBACK'); return error(res,409,'Cierra la sesión antes de desactivar o reasignar la caja.');
    }
    const falla = await validarAsignacion(client,asignado,sucursal,cajaId);
    if (falla) { await client.query('ROLLBACK'); return error(res,409,falla); }
    const r = await client.query(`UPDATE cajas SET nombre=$2,descripcion=$3,id_usuario_asignado=$4,activo=$5,fecha_actualizacion=now()
      WHERE id_caja=$1 RETURNING *`,[cajaId,nombre,descripcion||null,asignado,activo]);
    await client.query('COMMIT');
    res.json({ok:true,caja:r.rows[0],mensaje:'Caja actualizada.'});
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    if(e.code==='23505') return error(res,409,'Nombre de caja o asignación duplicada.');
    console.error('admin/cajas/put',e);error(res,500,'No fue posible actualizar la caja.');
  } finally {client.release();}
});

router.patch('/:id/estado', async(req,res)=>{
  const cajaId=enteroId(req.params.id);
  const activo=req.body?.activo;
  if(!cajaId || typeof activo!=='boolean') return error(res,400,'Estado inválido.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const c=await client.query('SELECT * FROM cajas WHERE id_caja=$1 FOR UPDATE',[cajaId]);
    if(!c.rowCount){await client.query('ROLLBACK');return error(res,404,'Caja no encontrada.');}
    const enUso=await client.query('SELECT 1 FROM caja_sesiones WHERE id_caja=$1 AND estado=\'ABIERTA\'',[cajaId]);
    if(!activo&&enUso.rowCount){await client.query('ROLLBACK');return error(res,409,'Primero cierra la sesión activa.');}
    if(activo){
      const s=await client.query('SELECT 1 FROM sucursales WHERE id_sucursal=$1 AND activa=TRUE',[c.rows[0].id_sucursal]);
      if(!s.rowCount){await client.query('ROLLBACK');return error(res,409,'Sucursal inactiva.');}
      const falla=await validarAsignacion(client,c.rows[0].id_usuario_asignado,c.rows[0].id_sucursal,cajaId);
      if(falla){await client.query('ROLLBACK');return error(res,409,falla);}
    }
    await client.query('UPDATE cajas SET activo=$2,fecha_actualizacion=now() WHERE id_caja=$1',[cajaId,activo]);
    await client.query('COMMIT');
    res.json({ok:true,mensaje:activo?'Caja activada.':'Caja desactivada.'});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return error(res,409,'El cajero ya tiene otra caja activa.');console.error('caja/estado',e);error(res,500,'No fue posible cambiar el estado.');}
  finally{client.release();}
});

module.exports=router;
