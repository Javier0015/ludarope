const express = require('express');
const pool = require('../config/db');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');
const { enteroId, aCentavos, monedaSql, permitirSucursal, permitirSesion, error, resumenSesion } = require('../services/cajaCore');
const { generarCorteCajaPdf } = require('../services/corteCajaPdf');
const { obtenerReporteCaja } = require('../services/cajaReporteService');

const router = express.Router();
router.use(verificarToken, autorizarRoles('ADMIN', 'CAJERO'));
const esAdmin = (req) => req.usuario.rol === 'ADMIN';
const usuarioId = (req) => Number(req.usuario.id_usuario);
const tiposPositivos = new Set(['ENTRADA','AJUSTE_POSITIVO']);
const tiposNegativos = new Set(['SALIDA','GASTO','RETIRO','PAGO_PROVEEDOR','AJUSTE_NEGATIVO']);
const denominaciones = [1000,500,200,100,50,20,10,5,2,1,0.5];

async function buscarCaja(client, cajaId) {
  const r = await client.query(`SELECT c.id_caja,c.id_sucursal,c.id_usuario_asignado,c.activo,c.nombre,
    s.activa AS sucursal_activa FROM cajas c JOIN sucursales s ON s.id_sucursal=c.id_sucursal WHERE c.id_caja=$1`,[cajaId]);
  return r.rows[0]||null;
}
function cajaPermitida(req,caja){
  return caja && permitirSucursal(req,caja.id_sucursal) && (esAdmin(req) || Number(caja.id_usuario_asignado)===usuarioId(req));
}
async function sesionAutorizada(req,res,idSesion,db=pool) {
  const r=await db.query(`SELECT id_sesion,id_caja,id_sucursal,id_usuario,estado FROM caja_sesiones WHERE id_sesion=$1`,[idSesion]);
  const sesion=r.rows[0];
  if(!sesion){ error(res,404,'Sesión inexistente.');return null;}
  if(!permitirSesion(req,sesion)){error(res,403,'Sesión no autorizada.');return null;}
  return sesion;
}

router.get('/cajas', async(req,res)=>{
  const sucursal=enteroId(req.query.id_sucursal||req.query.sucursal);
  if(!sucursal || !permitirSucursal(req,sucursal)) return error(res,403,'Sucursal no autorizada.');
  try{
    const r=await pool.query(`SELECT c.id_caja,c.id_sucursal,c.nombre,c.descripcion,c.activo,c.id_usuario_asignado,
      s.id_sesion AS sesion_abierta,s.id_usuario AS operador_actual
      FROM cajas c LEFT JOIN caja_sesiones s ON s.id_caja=c.id_caja AND s.estado='ABIERTA'
      WHERE c.id_sucursal=$1 AND c.activo=TRUE AND ($2::boolean OR c.id_usuario_asignado=$3)
      ORDER BY c.nombre`,[sucursal,esAdmin(req),usuarioId(req)]);
    res.json({ok:true,cajas:r.rows});
  }catch(e){console.error('caja/cajas',e);error(res,500,'No se pudieron consultar las cajas.');}
});

router.get('/sesion-abierta',async(req,res)=>{
  const cajaId=enteroId(req.query.id_caja);
  if(!cajaId) return error(res,400,'Selecciona una caja.');
  try{
    const caja=await buscarCaja(pool,cajaId);
    if(!cajaPermitida(req,caja)) return error(res,403,'Caja no autorizada.');
    const r=await pool.query(`SELECT se.id_sesion,se.id_caja,se.id_sucursal,se.id_usuario,se.monto_inicial,se.fecha_apertura,se.estado,
      u.nombre AS cajero FROM caja_sesiones se JOIN usuarios u ON u.id_usuario=se.id_usuario
      WHERE se.id_caja=$1 AND se.estado='ABIERTA' ORDER BY se.fecha_apertura DESC LIMIT 1`,[cajaId]);
    res.json({ok:true,sesion_abierta:r.rows[0]||null});
  }catch(e){console.error('caja/sesion-abierta',e);error(res,500,'No se pudo consultar la sesión.');}
});

router.post('/abrir',async(req,res)=>{
  const cajaId=enteroId(req.body?.id_caja);
  const inicial=aCentavos(req.body?.monto_inicial);
  if(!cajaId||inicial===null)return error(res,400,'Indica caja y fondo inicial válidos.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const r=await client.query(`SELECT c.*,s.activa AS sucursal_activa FROM cajas c
      JOIN sucursales s ON s.id_sucursal=c.id_sucursal WHERE c.id_caja=$1 FOR UPDATE OF c`,[cajaId]);
    const caja=r.rows[0];
    if(!caja || !caja.activo || !caja.sucursal_activa || !cajaPermitida(req,caja)){
      await client.query('ROLLBACK');return error(res,403,'Caja inactiva o no autorizada.');
    }
    // No permitir iniciar nuevas sesiones sobre una sesión antigua que todavía no tiene caja física.
    const antigua=await client.query(`SELECT 1 FROM caja_sesiones WHERE id_usuario=$1 AND estado='ABIERTA'`,[usuarioId(req)]);
    if(antigua.rowCount){await client.query('ROLLBACK');return error(res,409,'Ya tienes una sesión abierta. Ciérrala antes de abrir otra.');}
    const abierta=await client.query(`SELECT 1 FROM caja_sesiones WHERE id_caja=$1 AND estado='ABIERTA'`,[cajaId]);
    if(abierta.rowCount){await client.query('ROLLBACK');return error(res,409,'Esta caja ya tiene una sesión abierta.');}
    const ses=await client.query(`INSERT INTO caja_sesiones(id_caja,id_sucursal,id_usuario,monto_inicial)
      VALUES($1,$2,$3,$4) RETURNING id_sesion,id_caja,id_sucursal,id_usuario,monto_inicial,fecha_apertura,estado`,
      [cajaId,caja.id_sucursal,usuarioId(req),monedaSql(inicial)]);
    await client.query('COMMIT');
    res.status(201).json({ok:true,sesion:ses.rows[0],mensaje:'Caja abierta.'});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});
    if(e.code==='23505')return error(res,409,'Ya hay una sesión activa para este cajero o caja.');
    console.error('caja/abrir',e);error(res,500,'No se pudo abrir la caja.');
  }finally{client.release();}
});

router.get('/resumen',async(req,res)=>{
  const sesionId=enteroId(req.query.id_sesion);
  if(!sesionId)return error(res,400,'Sesión inválida.');
  try{
    const s=await sesionAutorizada(req,res,sesionId);
    if(!s)return;
    const info=await resumenSesion(pool,sesionId);
    const descuentos=await pool.query(`SELECT COALESCE(SUM(descuento_total),0) AS total FROM public.ventas
      WHERE id_sesion=$1 AND estado='COMPLETADA'`,[sesionId]);
    res.json({ok:true,...info,resumen:{...info.resumen,descuentos_promociones:descuentos.rows[0].total}});
  }catch(e){console.error('caja/resumen',e);error(res,500,'No se pudo generar el resumen.');}
});

router.get('/movimientos',async(req,res)=>{
  const sesionId=enteroId(req.query.id_sesion);
  if(!sesionId)return error(res,400,'Sesión inválida.');
  try{
    const s=await sesionAutorizada(req,res,sesionId);
    if(!s)return;
    const r=await pool.query(`SELECT m.id_movimiento,m.id_sesion,m.tipo,m.monto,m.concepto,m.referencia,
      m.observaciones,m.fecha_movimiento,u.nombre AS usuario
      FROM caja_movimientos m JOIN usuarios u ON u.id_usuario=m.id_usuario
      WHERE m.id_sesion=$1 ORDER BY m.fecha_movimiento DESC,m.id_movimiento DESC LIMIT 300`,[sesionId]);
    res.json({ok:true,movimientos:r.rows});
  }catch(e){console.error('caja/movimientos',e);error(res,500,'No se pudieron consultar movimientos.');}
});

router.post('/movimiento',async(req,res)=>{
  const sesionId=enteroId(req.body?.id_sesion);
  const tipo=String(req.body?.tipo||req.body?.tipo_movimiento||'').toUpperCase();
  const concepto=String(req.body?.concepto||'').trim();
  const monto=aCentavos(req.body?.monto);
  const referencia=String(req.body?.referencia||'').trim();
  const observaciones=String(req.body?.observaciones||'').trim();
  if(!sesionId || !(tiposPositivos.has(tipo)||tiposNegativos.has(tipo)) || monto===null||monto<=0 || !concepto || concepto.length>180 || referencia.length>120 || observaciones.length>500) return error(res,400,'Movimiento inválido.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const r=await client.query('SELECT * FROM caja_sesiones WHERE id_sesion=$1 FOR UPDATE',[sesionId]);
    const s=r.rows[0];
    if(!s || s.estado!=='ABIERTA'||!permitirSesion(req,s)){await client.query('ROLLBACK');return error(res,403,'La sesión no está abierta o no puedes operarla.');}
    if(s.id_caja==null){await client.query('ROLLBACK');return error(res,409,'Sesión anterior sin caja configurada.');}
    // El movimiento se anota en efectivo: otros medios de pago solo provienen del registro de ventas.
    if ((tipo==='AJUSTE_POSITIVO'||tipo==='AJUSTE_NEGATIVO') && !esAdmin(req)) {
      await client.query('ROLLBACK'); return error(res,403,'Los ajustes de caja requieren rol ADMIN.');
    }
    if (tiposNegativos.has(tipo)) {
      const info=await resumenSesion(client,sesionId);
      if (aCentavos(info.resumen.efectivo_esperado)<monto) {
        await client.query('ROLLBACK');return error(res,409,'El movimiento supera el efectivo esperado en caja.');
      }
    }
    const mov=await client.query(`INSERT INTO caja_movimientos(id_sesion,id_usuario,tipo,monto,concepto,referencia,observaciones)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sesionId,usuarioId(req),tipo,monedaSql(monto),concepto,referencia||null,observaciones||null]);
    await client.query('COMMIT');
    res.status(201).json({ok:true,movimiento:mov.rows[0],mensaje:'Movimiento registrado.'});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('caja/movimiento',e);error(res,500,'No se pudo registrar el movimiento.');}
  finally{client.release();}
});

router.post('/cerrar',async(req,res)=>{
  const sesionId=enteroId(req.body?.id_sesion);
  const contado=aCentavos(req.body?.efectivo_contado);
  const observaciones=String(req.body?.observaciones||'').trim();
  const conteo=req.body?.conteo_denominaciones || null;
  if(!sesionId || contado===null || observaciones.length>500)return error(res,400,'Verifica el importe contado y la sesión.');
  if(conteo!==null){
    if(typeof conteo!=='object'||Array.isArray(conteo)) return error(res,400,'Conteo por denominaciones inválido.');
    let total=0;
    for(const [valor,cantidad] of Object.entries(conteo)){
      if(!denominaciones.includes(Number(valor))||!Number.isSafeInteger(Number(cantidad))||Number(cantidad)<0||Number(cantidad)>100000) return error(res,400,'Denominación inválida.');
      total+=Math.round(Number(valor)*100)*Number(cantidad);
    }
    if(total!==contado)return error(res,400,'El total contado no coincide con las denominaciones.');
  }
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const s=await client.query('SELECT * FROM caja_sesiones WHERE id_sesion=$1 FOR UPDATE',[sesionId]);
    if(!s.rowCount || s.rows[0].estado!=='ABIERTA' || !permitirSesion(req,s.rows[0])) {
      await client.query('ROLLBACK');return error(res,403,'Sesión no autorizada o ya cerrada.');
    }
    const info=await resumenSesion(client,sesionId);
    const esperado=aCentavos(info.resumen.efectivo_esperado);
    const dif=contado-esperado;
    const r=await client.query(`UPDATE caja_sesiones SET estado='CERRADA',fecha_cierre=now(),
      efectivo_contado=$2,efectivo_esperado=$3,diferencia=$4,observaciones=$5,conteo_denominaciones=$6
      WHERE id_sesion=$1 RETURNING *`,
      [sesionId,monedaSql(contado),monedaSql(esperado),monedaSql(dif),observaciones||null,conteo?JSON.stringify(conteo):null]);
    await client.query('COMMIT');
    res.json({ok:true,cierre:r.rows[0],resumen:{...info.resumen,efectivo_contado:monedaSql(contado),diferencia:monedaSql(dif)}});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('caja/cerrar',e);error(res,500,'No se pudo cerrar la caja.');}
  finally{client.release();}
});

router.get('/historial',async(req,res)=>{
  const cajaId=enteroId(req.query.id_caja);
  if(!cajaId)return error(res,400,'Selecciona una caja.');
  try{
    const caja=await buscarCaja(pool,cajaId);
    if(!cajaPermitida(req,caja))return error(res,403,'Caja no autorizada.');
    const r=await pool.query(`SELECT s.id_sesion,s.id_usuario,s.id_caja,s.monto_inicial,s.fecha_apertura,
      s.fecha_cierre,s.estado,s.efectivo_contado,s.efectivo_esperado,s.diferencia,
      u.nombre AS cajero FROM caja_sesiones s JOIN usuarios u ON u.id_usuario=s.id_usuario
      WHERE s.id_caja=$1 AND ($2::boolean=TRUE OR s.id_usuario=$3) ORDER BY s.fecha_apertura DESC LIMIT 50`,[cajaId,esAdmin(req),usuarioId(req)]);
    res.json({ok:true,sesiones:r.rows});
  }catch(e){console.error('caja/historial',e);error(res,500,'No se pudo consultar el historial.');}
});

// La actividad incluye ventas, cancelaciones y movimientos manuales; siempre ligada a id_sesion.
router.get('/actividad',async(req,res)=>{
  const sesionId=enteroId(req.query.id_sesion);
  if(!sesionId) return error(res,400,'Sesión inválida.');
  try{
    const sesion=await sesionAutorizada(req,res,sesionId);
    if(!sesion) return;
    const reporte=await obtenerReporteCaja(pool,sesionId);
    return res.json({ok:true,actividad:reporte.actividad,diagnostico:esAdmin(req)?reporte.diagnostico:undefined});
  }catch(e){console.error('caja/actividad',e);return error(res,500,'No se pudo consultar la actividad de caja.');}
});

router.get('/reporte-cierre',async(req,res)=>{
  const sesionId=enteroId(req.query.id_sesion);
  if(!sesionId) return error(res,400,'Sesión inválida.');
  try{
    const sesion=await sesionAutorizada(req,res,sesionId);
    if(!sesion) return;
    if(sesion.estado!=='CERRADA') return error(res,409,'Esta sesión aún no está cerrada.');
    const reporte=await obtenerReporteCaja(pool,sesionId);
    return res.json({ok:true,...reporte,diagnostico:esAdmin(req)?reporte.diagnostico:undefined});
  }catch(e){console.error('caja/reporte',e);return error(res,500,'No se pudo generar el corte.');}
});

router.get('/reporte-cierre/:id/pdf',async(req,res)=>{
  const sesionId=enteroId(req.params.id);
  if(!sesionId) return error(res,400,'Sesión inválida.');
  try{
    const sesion=await sesionAutorizada(req,res,sesionId);
    if(!sesion) return;
    if(sesion.estado!=='CERRADA') return error(res,409,'La sesión aún está abierta.');
    const reporte=await obtenerReporteCaja(pool,sesionId);
    const pdf=await generarCorteCajaPdf(reporte);
    return res.set({
      'Content-Type':'application/pdf',
      'Content-Disposition':`attachment; filename="LUDAROPE_Corte_${sesionId}.pdf"`,
      'Cache-Control':'private, no-store','Content-Length':pdf.length,
    }).send(pdf);
  }catch(e){console.error('caja/reporte-pdf',e);return error(res,500,'No se pudo generar el corte PDF.');}
});
module.exports=router;
