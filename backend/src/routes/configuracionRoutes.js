'use strict';
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const pool = require('../config/db');
const { verificarToken } = require('../middlewares/authMiddleware');
const {
  cargarConfiguracion, validarTicket, validarGeneral, validarCorreo,
  cifrarSecreto, emailValido,
} = require('../services/configuracionService');
const { generarTicketPdf, enviarTicketPorCorreo } = require('../services/ticketService');
const router = express.Router();

const fallo = (res, estado, mensaje) => res.status(estado).json({ ok: false, mensaje });
router.use(verificarToken);
router.use(async (req,res,next) => {
  try {
    const userId = Number(req.usuario?.id_usuario);
    if (!Number.isSafeInteger(userId) || userId <= 0) return fallo(res, 401, 'Sesión inválida');
    const r = await pool.query('SELECT rol, activo FROM public.usuarios WHERE id_usuario=$1', [userId]);
    if (!r.rowCount || !r.rows[0].activo) return fallo(res, 401, 'La sesión ya no está activa');
    if (String(r.rows[0].rol).toUpperCase() !== 'ADMIN') return fallo(res, 403, 'Solo ADMIN puede configurar el sistema');
    next();
  } catch(err) { console.error('config/auth', err.code); fallo(res,500,'No se pudo validar el acceso'); }
});
const idUsuario = (req) => Number(req.usuario.id_usuario);

router.get('/', async (_req,res) => {
  try {
    const c = await cargarConfiguracion();
    res.json({ ok: true, ticket: c.ticket, general: c.general,
      correo: { ...c.correo, password: undefined },
      logo: c.logo_png ? `data:image/png;base64,${c.logo_png.toString('base64')}` : null });
  } catch (err) { console.error('config/GET', err.code); fallo(res,500,'No se pudo consultar la configuración. Verifica la migración SQL.'); }
});

router.put('/ticket', async (req,res) => {
  let ticket;
  try { ticket = validarTicket(req.body); }
  catch (err) { return fallo(res,400,err.message); }
  try {
    await pool.query(`UPDATE public.ludarope_configuracion SET ticket=$1::jsonb, actualizado_por=$2,
      fecha_actualizacion=now() WHERE id=1`, [JSON.stringify(ticket), idUsuario(req)]);
    res.json({ ok:true, ticket, mensaje:'Diseño de ticket guardado' });
  } catch (err) { console.error('config/ticket',err.code); fallo(res,500,'No se pudo guardar el ticket'); }
});
router.put('/general', async (req,res) => {
  const general = validarGeneral(req.body);
  try {
    await pool.query(`UPDATE public.ludarope_configuracion SET general=$1::jsonb, actualizado_por=$2,
      fecha_actualizacion=now() WHERE id=1`, [JSON.stringify(general), idUsuario(req)]);
    res.json({ ok:true, general, mensaje:'Configuración general guardada' });
  } catch (err) { console.error('config/general',err.code); fallo(res,500,'No se pudieron guardar los ajustes generales'); }
});

const uploadLogo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3*1024*1024, files:1 },
  fileFilter: (_req,file,cb) => cb(null,['image/png','image/jpeg','image/webp'].includes(file.mimetype)) });
router.post('/logo', (req,res) => uploadLogo.single('logo')(req,res,async (error) => {
  if (error) return fallo(res,400,'La imagen debe ser PNG, JPG o WebP y pesar como máximo 3 MB');
  if (!req.file) return fallo(res,400,'Selecciona una imagen PNG, JPG o WebP');
  try {
    const meta=await sharp(req.file.buffer).metadata();
    if (!meta.width || !meta.height || meta.width*meta.height > 20000000) return fallo(res,400,'Resolución de imagen excesiva');
    const png = await sharp(req.file.buffer).rotate().resize({ width: 720, height: 480, fit:'inside', withoutEnlargement:true })
      .png({ compressionLevel:9 }).toBuffer();
    await pool.query(`UPDATE public.ludarope_configuracion SET logo_png=$1, actualizado_por=$2,
      fecha_actualizacion=now() WHERE id=1`, [png,idUsuario(req)]);
    res.json({ ok:true,logo:`data:image/png;base64,${png.toString('base64')}`,mensaje:'Logo actualizado' });
  } catch(err) { console.error('config/logo',err.code); fallo(res,500,'No se pudo procesar la imagen'); }
}));
router.delete('/logo', async (req,res) => {
  try {
    await pool.query(`UPDATE public.ludarope_configuracion SET logo_png=NULL, actualizado_por=$1,
      fecha_actualizacion=now() WHERE id=1`,[idUsuario(req)]);
    res.json({ ok:true, mensaje:'Logo retirado. Se utilizará el diseño predeterminado.' });
  } catch(err) { console.error('config/logo-delete',err.code); fallo(res,500,'No se pudo retirar el logo'); }
});
router.put('/correo', async (req,res) => {
  let correo;
  try { correo=validarCorreo(req.body); }
  catch(err) { return fallo(res,400,err.message); }
  const nuevaPassword = String(req.body?.password || '');
  if (nuevaPassword.length > 256) return fallo(res,400,'La contraseña es demasiado larga');
  let cifrado=null;
  try { if (nuevaPassword) cifrado=cifrarSecreto(nuevaPassword); }
  catch(err) { return fallo(res,400,err.message); }
  try {
    const actual=await pool.query('SELECT smtp_password_enc FROM public.ludarope_configuracion WHERE id=1');
    if (correo.activo && !cifrado && !actual.rows[0]?.smtp_password_enc) return fallo(res,400,'Captura la contraseña SMTP para activar el envío');
    await pool.query(`UPDATE public.ludarope_configuracion
      SET smtp=$1::jsonb, smtp_password_enc=COALESCE($2,smtp_password_enc), actualizado_por=$3,
      fecha_actualizacion=now() WHERE id=1`, [JSON.stringify(correo),cifrado,idUsuario(req)]);
    res.json({ ok:true,correo:{...correo,tiene_password:Boolean(cifrado || actual.rows[0]?.smtp_password_enc)}, mensaje:'Configuración SMTP guardada' });
  } catch(err) { console.error('config/correo',err.code); fallo(res,500,'No se pudo guardar SMTP'); }
});

let ultimoTest = 0;
router.post('/correo/probar', async(req,res) => {
  const destino=String(req.body?.destino || '').trim();
  if (!emailValido(destino) || destino.length>254) return fallo(res,400,'Ingresa un correo de prueba válido');
  if (Date.now()-ultimoTest<20000) return fallo(res,429,'Espera 20 segundos antes de repetir la prueba');
  ultimoTest=Date.now();
  try {
    // Prueba REAL del formato final: HTML de ticket + PDF de ejemplo,
    // usando el mismo servicio que emplea el POS en las ventas.
    const config=await cargarConfiguracion();
    const venta={ folio:'PRUEBA-SIN-VENTA',fecha_venta:new Date(),nombre_caja:'CAJA PRINCIPAL',
      nombre_sucursal:'Sucursal de ejemplo',direccion_sucursal:'Av. Principal No. 8',
      nombre_cajero:'ADMINISTRADOR',subtotal:1946,descuento_total:150,total:1796,
      monto_recibido:1800,cambio:4,estado:'COMPLETADA' };
    const detalles=[
      {nombre_prenda:'VESTIDO MIDI ROSA',talla:'G',color:'Rosa',cantidad:1,precio_unitario:899,total_linea:899},
      {nombre_prenda:'LABIAL MATE NUDE',talla:'',color:'Nude',cantidad:2,precio_unitario:199,total_linea:398},
      {nombre_prenda:'BOLSO CROSSBODY',talla:'',color:'',cantidad:1,precio_unitario:649,total_linea:649},
    ];
    const pagos=[{metodo:'EFECTIVO',monto:1796}];
    const pdf=config.correo.adjuntar_pdf !== false
      ? await generarTicketPdf({venta,detalles,pagos},{...config,esPrevia:true})
      : null;
    await enviarTicketPorCorreo({correo:destino,venta,detalles,pagos,pdf,esPrueba:true});
    res.json({ok:true,mensaje:`Ticket de prueba enviado a ${destino} con las opciones elegidas`});
  } catch(err) { console.error('config/testmail',err.code || 'MAIL_ERROR');
    fallo(res,502,'No se pudo enviar el correo de prueba. Revisa servidor, puerto, TLS, usuario y contraseña.'); }
});

router.post('/ticket/vista-previa.pdf', async(req,res) => {
  try {
    const ticket=validarTicket(req.body?.ticket || {});
    const general=validarGeneral(req.body?.general || {});
    const actual=await cargarConfiguracion();
    const v={folio:'VISTA-PREVIA',fecha_venta:new Date(), nombre_caja:'CAJA PRINCIPAL', nombre_sucursal:'Sucursal de ejemplo',
      direccion_sucursal:'Av. Principal No. 8', nombre_cajero:'ADMINISTRADOR', subtotal:1946,
      descuento_total:150,total:1796,monto_recibido:1800,cambio:4,estado:'COMPLETADA'};
    const pdf=await generarTicketPdf({ venta:v, detalles:[
      {nombre_prenda:'VESTIDO MIDI ROSA',talla:'G',color:'Rosa',cantidad:1,precio_unitario:899,total_linea:899},
      {nombre_prenda:'LABIAL MATE NUDE',talla:'',color:'Nude',cantidad:2,precio_unitario:199,total_linea:398},
      {nombre_prenda:'BOLSO CROSSBODY',talla:'',color:'',cantidad:1,precio_unitario:649,total_linea:649},
    ],pagos:[{metodo:'EFECTIVO',monto:1796}] }, { ticket, general, logo_png:actual.logo_png, esPrevia:true });
    res.set({'Content-Type':'application/pdf','Cache-Control':'no-store',
      'Content-Disposition':'attachment; filename="LUDAROPE_Vista_Previa.pdf"'});
    res.send(pdf);
  } catch(err) { console.error('config/preview',err.code); fallo(res,500,'No se pudo generar la vista previa'); }
});
module.exports=router;
