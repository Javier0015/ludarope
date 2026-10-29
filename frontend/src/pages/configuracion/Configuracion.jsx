import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Settings2, ReceiptText, Mail, Palette, Store, Save, Loader2, UploadCloud, Trash2,
  Eye, EyeOff, CheckCircle2, RefreshCw, Send, FileDown, Leaf, ImagePlus,
  LockKeyhole, ShieldCheck, Info, Sparkles, Paintbrush, ChevronRight,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import './configuracion.css';

const ticketInicial = {
  nombre_negocio:'LUDAROPE', subtitulo:'Luce chingona.',rfc:'',direccion:'',telefono:'',
  mensaje_gracias:'¡GRACIAS POR SU COMPRA!',mensaje_pie:'CONSERVE SU TICKET PARA CUALQUIER DUDA O ACLARACIÓN',
  mensaje_ecologico:'Gracias por elegir un comprobante digital. Menos papel, más estilo.',
  color_primario:'#FC4D84',color_secundario:'#E7AA44',color_texto:'#302730',
  mostrar_rfc:true,mostrar_direccion:true,mostrar_telefono:true,mostrar_descuento:true,
  mostrar_impuesto:false,mostrar_ahorro:true,mostrar_ecologico:true,formato:'detallado',
};
const correoInicial = {
  activo:false,host:'',puerto:587,secure:false,usuario:'',remitente:'',
  nombre_remitente:'LUDAROPE',asunto_ticket:'Tu comprobante de compra · LUDAROPE · {folio}',
  cuerpo_ticket:'¡Gracias por tu compra en LUDAROPE!\nAquí encontrarás los detalles de tu compra.\nLuce chingona.',
  incluir_ticket_html:true, adjuntar_pdf:true, usar_diseno_ticket:true,
  password:'',tiene_password:false,
};
const generalInicial = {slogan:'Luce chingona.',moneda:'MXN',zona_horaria:'America/Mexico_City'};
const moneda=(v)=>Number(v).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const input='ld-cfg-input';

function FormField({children,titulo,ayuda}) { return <label className="block min-w-0">
  <span className="mb-1.5 block text-xs font-extrabold text-[#63515C]">{titulo}</span>
  {children}{ayuda&&<span className="mt-1.5 block text-[11px] leading-relaxed text-[#9B8490]">{ayuda}</span>}
</label>; }
function Interruptor({label,descripcion,value,onChange}) { return <label className="ld-cfg-check flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#F2E4E9] bg-white p-3.5">
  <span className="min-w-0"><span className="block text-xs font-extrabold text-[#4D3C46]">{label}</span>{descripcion&&<span className="mt-0.5 block text-[11px] text-[#9A8590]">{descripcion}</span>}</span>
  <span className={`ld-cfg-switch shrink-0 ${value?'checked':''}`}><input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)} aria-label={label}/><i /></span>
</label>; }
function OjoMarca({rosa='#FC4D84',dorado='#E7AA44',grande=false}) {return <svg viewBox="0 0 180 120" width={grande?146:118} height={grande?94:78} role="img" aria-label="Isotipo de ojo LUDAROPE">
  {Array.from({length:11},(_,i)=>{const ang=(-150+i*12)*Math.PI/180;const x=90+Math.cos(ang)*54,y=64+Math.sin(ang)*54;return <line key={i} x1={x} y1={y} x2={90+Math.cos(ang)*69} y2={64+Math.sin(ang)*69} stroke={dorado} strokeWidth="2.4" strokeLinecap="round"/>;})}
  <path d="M30 64 Q90 1 150 64 Q90 126 30 64 Z" stroke={dorado} strokeWidth="4" fill="none" strokeLinejoin="round"/>
  <circle cx="90" cy="64" r="27" fill={rosa}/><circle cx="90" cy="64" r="15" fill={dorado}/><circle cx="90" cy="64" r="7" fill="#fff"/>
</svg>; }
function VistaPrevia({ticket,logo}) {
 const rosa=ticket.color_primario,dorado=ticket.color_secundario,tinta=ticket.color_texto;
 const compacto=ticket.formato==='compacto';
 const productos=[['1','VESTIDO MIDI ROSA',899],['2','LABIAL MATE NUDE',398],['1','BOLSO CROSSBODY',649]];
 return <div className="ld-cfg-ticket" style={{'--ticket-rosa':rosa,'--ticket-dorado':dorado,'--ticket-tinta':tinta}}>
    <div className="ld-cfg-corner ld-cfg-corner-top"/><div className="ld-cfg-curve-top"/>
    <div className="ld-cfg-ticket-watermark"><OjoMarca rosa={rosa} dorado={dorado} grande/></div>
    <div className="relative z-[1]">
      <div className="flex min-h-[100px] items-center justify-center pt-3">
        {logo?<img src={logo} alt="Logo configurado" className="max-h-[102px] max-w-[185px] object-contain"/>:<OjoMarca rosa={rosa} dorado={dorado} grande/>}
      </div>
      <div className="mt-1 text-center text-[26px] font-extrabold tracking-[.18em]" style={{color:rosa}}>{ticket.nombre_negocio||'LUDAROPE'}</div>
      {ticket.subtitulo&&<div className="text-center text-[10px] font-bold uppercase tracking-[.34em]" style={{color:dorado}}>{ticket.subtitulo}</div>}
      <div className="mt-2 text-center text-[11px] leading-[1.45]" style={{color:tinta}}>
        <p>Sucursal de ejemplo</p>
        {ticket.mostrar_rfc&&ticket.rfc&&<p>RFC: {ticket.rfc}</p>}
        {ticket.mostrar_direccion&&<p>{ticket.direccion||'Av. Principal No. 8'}</p>}
        {ticket.mostrar_telefono&&ticket.telefono&&<p>TEL. {ticket.telefono}</p>}
      </div>
      <div className="my-2.5 border-t" style={{borderColor:rosa}}/>
      <div className="mb-3 text-center text-[10px]">23/06/2026, 11:45 A. M.</div>
      <div className="space-y-0.5 text-[10px] leading-4"><p><b style={{color:rosa}}>CAJERO:</b> ADMINISTRADOR</p><p><b style={{color:rosa}}>CAJA:</b> CAJA PRINCIPAL</p><p><b style={{color:rosa}}>FOLIO:</b> VISTA-PREVIA</p></div>
      <div className="mt-3 grid grid-cols-[38px_1fr_74px] rounded-lg px-2 py-2 text-[10px] font-black" style={{background:'#FCE8EE',color:rosa}}><span>CANT.</span><span>DESCRIPCIÓN</span><span className="text-right">IMPORTE</span></div>
      <div className="relative space-y-0 text-[10px]">{productos.map(([cantidad,nombre,importe],i)=><div key={i} className="grid grid-cols-[38px_1fr_74px] gap-0 border-b px-2 py-2" style={{borderColor:'#F5C6D8',color:tinta}}><span className="text-center">{cantidad}</span><span>{nombre}{!compacto&&i===1&&<small className="block text-[9px] text-[#857680]">Color: Nude</small>}</span><span className="text-right">{moneda(importe)}</span></div>)}</div>
      <div className="mt-3 space-y-0.5 text-[10px]" style={{color:tinta}}>
        <ResumenFila label="NO. DE ARTÍCULOS:" valor="4"/>
        <ResumenFila label="SUBTOTAL:" valor={moneda(1946)}/>
        {ticket.mostrar_impuesto&&<ResumenFila label="IMPUESTO:" valor="No desglosado"/>}
        {ticket.mostrar_descuento&&<ResumenFila label="DESCUENTO:" valor={moneda(150)}/>}
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-lg bg-[#FCE8EE] px-2 py-1.5 text-base font-black" style={{color:rosa}}><span>TOTAL:</span><span>{moneda(1796)}</span></div>
      <div className="mt-3 space-y-1 text-[10px]" style={{color:tinta}}><ResumenFila label="EFECTIVO:" valor={moneda(1796)}/><ResumenFila label="RECIBIDO:" valor={moneda(1800)}/><ResumenFila label="SU CAMBIO:" valor={moneda(4)}/>{ticket.mostrar_ahorro&&<ResumenFila label="USTED AHORRÓ:" valor={moneda(150)}/>}</div>
      <div className="mt-6 flex items-center gap-2"><span className="h-px flex-1" style={{background:dorado}}/><p className="text-center text-[10px] font-black tracking-[.14em]" style={{color:rosa}}>{ticket.mensaje_gracias}</p><span className="h-px flex-1" style={{background:dorado}}/></div>
      <div className="mt-2 text-center text-[9px] leading-[1.5]" style={{color:tinta}}>{ticket.mensaje_pie}</div>
      {ticket.mostrar_ecologico&&<div className="mt-3 flex items-center justify-center gap-1 text-center text-[9px] font-semibold text-[#528965]"><Leaf size={13}/>{ticket.mensaje_ecologico}</div>}
      <p className="mt-3 text-center text-[8px] text-[#A99DA2]">Comprobante de compra. No sustituye CFDI.</p>
    </div>
    <div className="ld-cfg-corner ld-cfg-corner-bottom"/><div className="ld-cfg-curve-bottom"/>
  </div>;
}
function ResumenFila({label,valor}){return <div className="flex items-start justify-between gap-2"><span>{label}</span><span className="text-right">{valor}</span></div>;}
const mensajeError=async(e,defecto)=>{if(e?.response?.data instanceof Blob){try{return JSON.parse(await e.response.data.text()).mensaje||defecto;}catch{return defecto;}}return e?.response?.data?.mensaje||defecto;};
function bajarBlob(blob,nombre){const url=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}

export default function Configuracion(){
 const {usuario}=useAuth();
 const admin=String(usuario?.rol||'').toUpperCase()==='ADMIN';
 const [tab,setTab]=useState('ticket');
 const [ticket,setTicket]=useState(ticketInicial);
 const [correo,setCorreo]=useState(correoInicial);
 const [general,setGeneral]=useState(generalInicial);
 const [logo,setLogo]=useState(null);
 const [cargando,setCargando]=useState(true);
 const [procesando,setProcesando]=useState('');
 const [mostrarPassword,setMostrarPassword]=useState(false);
 const [correoPrueba,setCorreoPrueba]=useState('');
 const ct=(k,v)=>setTicket(p=>({...p,[k]:v}));
 const ce=(k,v)=>setCorreo(p=>({...p,[k]:v}));
 const cargar=useCallback(async()=>{try {setCargando(true);const {data}=await api.get('/configuracion');
   if(!data.ok)throw new Error('Error de configuración');
   setTicket({...ticketInicial,...data.ticket});setCorreo({...correoInicial,...data.correo,password:''});
   setGeneral({...generalInicial,...data.general});setLogo(data.logo||null);
 }catch(e){Swal.fire('No se pudo cargar',e.response?.data?.mensaje||'Verifica que instalaste el backend y ejecutaste la migración.', 'error');}
 finally{setCargando(false);}},[]);
 useEffect(()=>{if(admin)cargar();else setCargando(false);},[admin,cargar]);
 async function guardar(seccion){try{setProcesando(seccion);
   const contenido=seccion==='ticket'?ticket:seccion==='correo'?correo:general;
   const {data}=await api.put(`/configuracion/${seccion}`,contenido);
   if(!data.ok)throw new Error('No se pudo guardar');
   if(seccion==='correo')setCorreo(p=>({...p,tiene_password:data.correo?.tiene_password??p.tiene_password,password:''}));
   await Swal.fire({icon:'success',title:'Configuración guardada',text:data.mensaje,timer:1300,showConfirmButton:false});
 }catch(e){Swal.fire('No se pudo guardar',await mensajeError(e,'Revisa los campos'), 'error');}
 finally{setProcesando('');}}
 async function subirLogo(e){const archivo=e.target.files?.[0];e.target.value='';if(!archivo)return;
   if(!['image/png','image/jpeg','image/webp'].includes(archivo.type)||archivo.size>3*1024*1024)return Swal.fire('Archivo no válido','Usa PNG, JPG o WebP de máximo 3 MB','warning');
   try{setProcesando('logo');const f=new FormData();f.append('logo',archivo);const{data}=await api.post('/configuracion/logo',f);
     setLogo(data.logo);Swal.fire({icon:'success',title:'Logo actualizado',timer:1100,showConfirmButton:false});}
   catch(err){Swal.fire('Error',await mensajeError(err,'No se pudo cargar el logo'),'error');}finally{setProcesando('');}}
 async function quitarLogo(){const r=await Swal.fire({title:'¿Retirar logo?',text:'Se usará el isotipo predeterminado en los tickets.',icon:'question',showCancelButton:true,confirmButtonText:'Retirar',cancelButtonText:'Cancelar',confirmButtonColor:'#FC4D84'});
   if(!r.isConfirmed)return;try{setProcesando('logo');await api.delete('/configuracion/logo');setLogo(null);}catch(e){Swal.fire('Error',await mensajeError(e,'No se pudo quitar el logo'),'error');}finally{setProcesando('');}}
 async function descargarPrevia(){try{setProcesando('previsualizar');const r=await api.post('/configuracion/ticket/vista-previa.pdf',{ticket,general},{responseType:'blob'});bajarBlob(r.data,'LUDAROPE_Vista_Previa.pdf');}
 catch(e){Swal.fire('No se pudo generar PDF',await mensajeError(e,'Revisa los datos del diseño'),'error');}finally{setProcesando('');}}
 async function probarCorreo(){if(!correoPrueba.trim())return Swal.fire('Falta el destinatario','Escribe un correo para la prueba.','warning');
   try{setProcesando('probar');const{data}=await api.post('/configuracion/correo/probar',{destino:correoPrueba.trim()});Swal.fire('Correo enviado',data.mensaje,'success');}
   catch(e){Swal.fire('Prueba fallida',await mensajeError(e,'No se pudo enviar el mensaje'),'error');}finally{setProcesando('');}}
 if(!admin)return <div className="rounded-2xl bg-white p-8 text-sm text-red-700"><ShieldCheck className="mb-2"/>Solo ADMIN puede acceder a Configuración.</div>;
 return <div className="ld-cfg mx-auto w-full max-w-[1600px] space-y-5 pb-12">
   <header className="ld-cfg-card relative overflow-hidden p-5 sm:p-7"><div className="absolute -right-16 -top-28 h-64 w-64 rounded-full bg-[#FC4D84]/10 blur-3xl"/>
     <div className="relative flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#FC4D84]">LUDAROPE / Administración</p><h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Configuración del sistema<span className="text-[#FC4D84]">.</span></h1><p className="mt-1 text-sm text-[#8A7480]">Personaliza el comprobante digital y administra el correo de tu tienda.</p></div></div>
       <button type="button" disabled={cargando} onClick={cargar} className="ld-cfg-btn-secondary"><RefreshCw size={16}/> Actualizar</button></div>
   </header>
   <div className="flex flex-wrap gap-2 rounded-2xl border border-[#F1DEE5] bg-white p-2">
     {[['ticket','Ticket digital',ReceiptText],['correo','Correo SMTP',Mail],['general','General',Store]].map(([key,nombre,Icono])=><button key={key} type="button" onClick={()=>setTab(key)} className={`ld-cfg-tab ${tab===key?'active':''}`}><Icono size={18}/>{nombre}</button>)}
   </div>
   {cargando?<div className="ld-cfg-card flex items-center justify-center gap-3 p-20 text-[#B95A7F]"><Loader2 className="animate-spin"/>Cargando configuración...</div>:
   tab==='ticket'?<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(330px,.8fr)]">
     <div className="space-y-5">
       <section className="ld-cfg-card p-5 sm:p-6"><Titulo icon={ReceiptText} titulo="Información del comprobante" sub="Los datos de la operación real siempre se obtienen del POS."/>
         <div className="mt-5 grid gap-4 sm:grid-cols-2"><FormField titulo="Nombre comercial"><input className={input} maxLength={80} value={ticket.nombre_negocio} onChange={e=>ct('nombre_negocio',e.target.value)}/></FormField>
          <FormField titulo="Subtítulo / eslogan"><input className={input} maxLength={100} value={ticket.subtitulo} onChange={e=>ct('subtitulo',e.target.value)}/></FormField>
          <FormField titulo="RFC (opcional)"><input className={input} maxLength={25} value={ticket.rfc} onChange={e=>ct('rfc',e.target.value)} placeholder="RFC del negocio"/></FormField>
          <FormField titulo="Teléfono (opcional)"><input className={input} maxLength={50} value={ticket.telefono} onChange={e=>ct('telefono',e.target.value)} placeholder="Teléfono de contacto"/></FormField>
          <div className="sm:col-span-2"><FormField titulo="Dirección comercial (opcional)" ayuda="Si se deja en blanco, el PDF mostrará la dirección guardada con la venta."><textarea className={input} rows={2} maxLength={300} value={ticket.direccion} onChange={e=>ct('direccion',e.target.value)}/></FormField></div>
         </div>
       </section>
       <section className="ld-cfg-card p-5 sm:p-6"><Titulo icon={ImagePlus} titulo="Logo de LUDAROPE" sub="PNG, JPG o WebP. Si no cargas un logo, mostraremos el isotipo del ojo."/>
         <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#ECC6D5] bg-[#FFFAFC] p-5 sm:flex-row"><div className="flex h-28 w-36 items-center justify-center rounded-2xl bg-white p-3 shadow-sm">{logo?<img className="max-h-full max-w-full object-contain" src={logo} alt="Logo"/>:<OjoMarca/>}</div><div className="flex flex-wrap gap-2"><label className="ld-cfg-btn-secondary cursor-pointer"><UploadCloud size={17}/> Subir logo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={subirLogo} disabled={Boolean(procesando)}/></label>{logo&&<button type="button" onClick={quitarLogo} disabled={Boolean(procesando)} className="ld-cfg-btn-secondary"><Trash2 size={16}/> Retirar</button>}</div></div>
       </section>
       <section className="ld-cfg-card p-5 sm:p-6"><Titulo icon={Palette} titulo="Colores y formato" sub="Conserva el estilo rosa y dorado de tu prototipo o personalízalo."/>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">{[['color_primario','Rosa principal'],['color_secundario','Acento dorado'],['color_texto','Texto']].map(([k,label])=><FormField key={k} titulo={label}><div className="flex items-center gap-2 rounded-xl border border-[#EFDBE3] bg-white p-2"><input className="h-9 w-11 shrink-0 cursor-pointer rounded border-0" type="color" value={ticket[k]} onChange={e=>ct(k,e.target.value)}/><span className="text-xs font-bold text-[#735968]">{ticket[k]}</span></div></FormField>)}</div>
         <div className="mt-4"><FormField titulo="Presentación"><select className={input} value={ticket.formato} onChange={e=>ct('formato',e.target.value)}><option value="detallado">Detallado (con detalles de cada prenda)</option><option value="compacto">Compacto</option></select></FormField></div>
       </section>
       <section className="ld-cfg-card p-5 sm:p-6"><Titulo icon={Paintbrush} titulo="Mensajes y datos visibles" sub="Selecciona qué información aparecerá en los comprobantes."/>
        <div className="mt-5 space-y-4"><FormField titulo="Mensaje de agradecimiento"><input className={input} maxLength={130} value={ticket.mensaje_gracias} onChange={e=>ct('mensaje_gracias',e.target.value)}/></FormField>
          <FormField titulo="Leyenda al pie"><textarea className={input} rows={2} maxLength={260} value={ticket.mensaje_pie} onChange={e=>ct('mensaje_pie',e.target.value)}/></FormField>
          <FormField titulo="Mensaje ecológico"><textarea className={input} rows={2} maxLength={240} value={ticket.mensaje_ecologico} onChange={e=>ct('mensaje_ecologico',e.target.value)}/></FormField>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">{[['mostrar_rfc','Mostrar RFC'],['mostrar_direccion','Mostrar dirección'],['mostrar_telefono','Mostrar teléfono'],['mostrar_descuento','Mostrar descuentos'],['mostrar_impuesto','Mostrar impuesto'],['mostrar_ahorro','Mostrar ahorro'],['mostrar_ecologico','Mostrar mensaje ecológico']].map(([k,label])=><Interruptor key={k} label={label} value={ticket[k]} onChange={v=>ct(k,v)}/>)}</div>
        <div className="mt-4 rounded-xl bg-[#FFF6EC] p-3 text-xs leading-relaxed text-[#94633D]"><Info className="mr-2 inline" size={15}/>El POS actual no calcula impuestos de manera independiente. Si activas ese campo, mostrará «No desglosado»; no modifica el importe cobrado.</div>
       </section>
       <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={()=>{setTicket({...ticketInicial});}} className="ld-cfg-btn-secondary"><RefreshCw size={16}/> Valores iniciales</button><button type="button" disabled={Boolean(procesando)} onClick={()=>guardar('ticket')} className="ld-cfg-btn-primary">{procesando==='ticket'?<Loader2 size={17} className="animate-spin"/>:<Save size={17}/>} Guardar diseño</button></div>
     </div>
     <aside className="xl:sticky xl:top-5"><section className="ld-cfg-card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-black text-[#392B35]">Vista previa del ticket</h2><p className="text-xs text-[#A58C97]">Ejemplo ilustrativo · actualización instantánea</p></div><Eye className="text-[#FC4D84]" size={22}/></div>
       <div className="flex justify-center overflow-auto rounded-2xl bg-[#F8F0F3] p-3 sm:p-5"><VistaPrevia ticket={ticket} logo={logo}/></div>
       <button type="button" disabled={Boolean(procesando)} onClick={descargarPrevia} className="ld-cfg-btn-secondary mt-4 w-full justify-center">{procesando==='previsualizar'?<Loader2 size={17} className="animate-spin"/>:<FileDown size={17}/>} Descargar PDF de prueba</button>
       <p className="mt-3 text-xs leading-relaxed text-[#998591]">La vista previa usa datos ficticios. El PDF de prueba permite revisar el diseño que se enviará al cliente.</p>
       </section></aside>
   </div>:tab==='correo'?<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.65fr)]">
    <section className="ld-cfg-card p-5 sm:p-6"><Titulo icon={Mail} titulo="Correo electrónico / SMTP" sub="Configura el servidor que enviará el comprobante PDF al cliente."/>
      <div className="mt-5"><Interruptor label="Habilitar configuración de correo" descripcion="Usar los datos SMTP guardados aquí en vez de las variables antiguas del servidor." value={correo.activo} onChange={v=>ce('activo',v)}/></div>
      <div className="mt-5 space-y-2 rounded-2xl border border-[#F3DCE5] bg-[#FFF9FC] p-4">
        <p className="text-sm font-black text-[#45343D]">Presentación del comprobante en el correo</p>
        <p className="text-xs leading-relaxed text-[#907985]">El cliente puede ver el ticket en su correo y conservar el PDF adjunto. Los importes siempre se toman de la venta registrada.</p>
        <div className="mt-3 grid gap-2">
          <Interruptor label="Mostrar ticket en el cuerpo del correo" descripcion="Incluye el detalle de prendas, pagos, folio y totales como HTML." value={correo.incluir_ticket_html} onChange={v=>ce('incluir_ticket_html',v)}/>
          <Interruptor label="Adjuntar comprobante PDF" descripcion="Incluye el mismo comprobante como archivo descargable." value={correo.adjuntar_pdf} onChange={v=>ce('adjuntar_pdf',v)}/>
          {correo.incluir_ticket_html&&<Interruptor label="Usar diseño del ticket PDF" descripcion="Aplica logo, rosa, dorado, encabezado y mensajes guardados en Ticket digital." value={correo.usar_diseno_ticket} onChange={v=>ce('usar_diseno_ticket',v)}/>}
        </div>
        {!correo.incluir_ticket_html&&!correo.adjuntar_pdf&&<p role="alert" className="text-xs font-bold text-red-600">Activa al menos una opción: ticket en el correo o PDF adjunto.</p>}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FormField titulo="Servidor SMTP"><input className={input} value={correo.host} onChange={e=>ce('host',e.target.value)} placeholder="smtp.ejemplo.com"/></FormField>
        <FormField titulo="Puerto"><input className={input} type="number" min={1} max={65535} value={correo.puerto} onChange={e=>ce('puerto',e.target.value)}/></FormField>
        <FormField titulo="Usuario SMTP"><input className={input} autoComplete="username" value={correo.usuario} onChange={e=>ce('usuario',e.target.value)} placeholder="correo@dominio.com"/></FormField>
        <FormField titulo="Contraseña de aplicación" ayuda={correo.tiene_password?'Ya hay una contraseña guardada. Déjala vacía para conservarla.':'La contraseña se guarda cifrada en el servidor.'}><div className="relative"><input className={`${input} pr-11`} type={mostrarPassword?'text':'password'} autoComplete="new-password" value={correo.password} onChange={e=>ce('password',e.target.value)} placeholder={correo.tiene_password?'•••••••• (sin cambios)':'Contraseña SMTP'}/><button type="button" onClick={()=>setMostrarPassword(v=>!v)} aria-label="Mostrar u ocultar contraseña" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#986D81]">{mostrarPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></FormField>
        <FormField titulo="Correo del remitente"><input className={input} type="email" value={correo.remitente} onChange={e=>ce('remitente',e.target.value)} placeholder="ventas@dominio.com"/></FormField>
        <FormField titulo="Nombre del remitente"><input className={input} value={correo.nombre_remitente} onChange={e=>ce('nombre_remitente',e.target.value)} placeholder="LUDAROPE"/></FormField>
        <div className="sm:col-span-2"><Interruptor label="Conexión SSL/TLS directa (puerto 465)" descripcion="Desactivado usa STARTTLS obligatorio, normalmente en el puerto 587." value={correo.secure} onChange={v=>ce('secure',v)}/></div>
        <div className="sm:col-span-2"><FormField titulo="Asunto del mensaje" ayuda="Variables disponibles: {folio}, {total}, {sucursal}"><input className={input} value={correo.asunto_ticket} onChange={e=>ce('asunto_ticket',e.target.value)}/></FormField></div>
        <div className="sm:col-span-2"><FormField titulo="Mensaje introductorio del correo" ayuda="Aparecerá encima del ticket HTML. Puedes usar {folio}, {total} y {sucursal}."><textarea className={input} rows={6} value={correo.cuerpo_ticket} onChange={e=>ce('cuerpo_ticket',e.target.value)}/></FormField></div>
      </div>
      <div className="mt-6 flex justify-end"><button type="button" disabled={Boolean(procesando)} onClick={()=>guardar('correo')} className="ld-cfg-btn-primary">{procesando==='correo'?<Loader2 size={17} className="animate-spin"/>:<Save size={17}/>} Guardar configuración SMTP</button></div>
    </section>
    <aside className="space-y-5"><section className="ld-cfg-card p-5"><Titulo icon={Send} titulo="Correo de prueba" sub=""/>
      <div className="mt-4"><FormField titulo="Destinatario de prueba"><input className={input} type="email" value={correoPrueba} onChange={e=>setCorreoPrueba(e.target.value)} placeholder="tucorreo@dominio.com"/></FormField></div>
      <button type="button" disabled={Boolean(procesando)} onClick={probarCorreo} className="ld-cfg-btn-secondary mt-4 w-full justify-center">{procesando==='probar'?<Loader2 className="animate-spin" size={16}/>:<Send size={16}/>} Enviar prueba</button>
    </section></aside>
   </div>:<div className="ld-cfg-card max-w-3xl p-5 sm:p-6"><Titulo icon={Store} titulo="Configuración general" sub="Preferencias globales de LUDAROPE."/>
     <div className="mt-6 space-y-5"><FormField titulo="Eslogan de marca"><input className={input} value={general.slogan} maxLength={130} onChange={e=>setGeneral(p=>({...p,slogan:e.target.value}))}/></FormField>
       <div className="grid gap-4 sm:grid-cols-2"><FormField titulo="Moneda"><input className={`${input} bg-[#FFF9FB]`} value="Peso mexicano · MXN" readOnly/></FormField><FormField titulo="Zona horaria"><input className={`${input} bg-[#FFF9FB]`} value="America/Mexico_City" readOnly/></FormField></div>
       <div className="flex gap-3 rounded-2xl border border-[#F3E2E9] bg-[#FFF8FB] p-4"><Leaf className="shrink-0 text-[#4C9262]"/><p className="text-xs leading-relaxed text-[#856E7B]">Los comprobantes de LUDAROPE serán exclusivamente digitales: descarga PDF y envío por correo. No incluimos impresoras, códigos QR ni WhatsApp.</p></div>
       <div className="flex justify-end"><button type="button" disabled={Boolean(procesando)} onClick={()=>guardar('general')} className="ld-cfg-btn-primary">{procesando==='general'?<Loader2 size={17} className="animate-spin"/>:<Save size={17}/>} Guardar ajustes generales</button></div>
     </div></div>}
  </div>;
}
function Titulo({icon:Icono,titulo,sub}){return <div className="flex items-start gap-3"><span className="rounded-xl bg-[#FFF0F5] p-2.5 text-[#FC4D84]"><Icono size={21}/></span><div><h2 className="text-lg font-black text-[#362C34]">{titulo}</h2><p className="mt-1 text-xs leading-relaxed text-[#9A8390]">{sub}</p></div></div>;}
