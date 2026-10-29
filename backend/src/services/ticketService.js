'use strict';
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const sharp = require('sharp');
const { renderTicketEmailHTML, renderCorreoBasico, plantillaTexto } = require('./ticketEmailHtml');
const { cargarConfiguracion, transporteCorreo } = require('./configuracionService');

const mxn = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const limpiar = (v) => String(v ?? '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
function formatearFecha(value) {
  const d = new Date(value || Date.now());
  return new Intl.DateTimeFormat('es-MX', {timeZone:'America/Mexico_City',dateStyle:'short',timeStyle:'short'}).format(d);
}
function dibujarOjo(doc, x, y, escala, rosa, dorado) {
  doc.save();
  doc.lineWidth(1.8*escala).strokeColor(dorado);
  for (let i=-5;i<=5;i++) {
    const ang = -Math.PI/2+i*0.23;
    const dx=Math.cos(ang),dy=Math.sin(ang);
    doc.moveTo(x+dx*37*escala,y+dy*27*escala).lineTo(x+dx*50*escala,y+dy*41*escala).stroke();
  }
  doc.moveTo(x-43*escala,y).bezierCurveTo(x-17*escala,y-32*escala,x+15*escala,y-32*escala,x+43*escala,y)
    .bezierCurveTo(x+15*escala,y+32*escala,x-17*escala,y+32*escala,x-43*escala,y).closePath().stroke();
  doc.circle(x,y,21*escala).fillColor(rosa).fill();
  doc.circle(x,y,11*escala).fillColor(dorado).fill();
  doc.circle(x,y,5*escala).fillColor('#FFFDFE').fill();
  doc.restore();
}
function esquinaSuperior(doc, rosa, dorado, w) {
  doc.save();
  doc.moveTo(0,0).lineTo(84,0).bezierCurveTo(74,29,42,29,0,91).closePath().fillColor(rosa).fill();
  doc.lineWidth(1).strokeColor(dorado).moveTo(98,0).bezierCurveTo(94,28,52,34,0,112).stroke();
  doc.restore();
}
function esquinaInferior(doc, rosa, dorado, w, h) {
  doc.save();
  doc.moveTo(w,h).lineTo(w-86,h).bezierCurveTo(w-50,h-29,w-32,h-44,w,h-95).closePath().fillColor(rosa).fill();
  doc.strokeColor(dorado).lineWidth(1).moveTo(w-100,h).bezierCurveTo(w-62,h-30,w-46,h-62,w,h-111).stroke();
  doc.restore();
}
function linea(doc, x, w, y, rosa) { doc.strokeColor(rosa).lineWidth(0.6).moveTo(x,y).lineTo(x+w,y).stroke(); }
function filaMonto(doc, label, valor, y, w, tinta, {bold=false,color=null}= {}) {
  const x=28;
  doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(bold?10:9).fillColor(color||tinta);
  doc.text(label,x,y,{width:w*.62});
  doc.text(valor,x+w*.62,y,{width:w*.38,align:'right'});
  return y+17;
}
function construirPdf({ venta, detalles=[], pagos=[] }, config, logo_png, esPrevia) {
  return new Promise((resolve,reject) => {
    const ticket=config.ticket;
    const rosa=ticket.color_primario, dorado=ticket.color_secundario, tinta=ticket.color_texto;
    const w=340, margen=28, cw=w-2*margen;
    const compacto=ticket.formato==='compacto';
    const bloques=detalles.reduce((a,d)=>a + (limpiar(d.nombre_prenda || d.nombre).length>28?20:0),0);
    const h=Math.max(780, 710 + detalles.length*(compacto?55:78) + bloques + pagos.length*22 + (ticket.mostrar_ecologico?42:0));
    const doc=new PDFDocument({size:[w,h],margin:0,info:{Title:`Comprobante ${limpiar(venta.folio)}`,Author:'LUDAROPE POS'},compress:true});
    const parts=[]; doc.on('data', chunk=>parts.push(chunk)); doc.on('error',reject);
    doc.on('end',()=>resolve(Buffer.concat(parts)));
    doc.rect(0,0,w,h).fill('#FFFFFF');
    esquinaSuperior(doc,rosa,dorado,w); esquinaInferior(doc,rosa,dorado,w,h);
    if (esPrevia) {
      doc.save().rotate(-28,{origin:[w/2,h/2]});
      doc.font('Helvetica-Bold').fontSize(38).fillColor('#EFE4E7').opacity(.34)
        .text('VISTA PREVIA',17,h/2-10,{width:w-34,align:'center'});
      doc.restore();
    }
    let y=44;
    if (logo_png) {
      try { doc.image(logo_png,w/2-43,y-10,{fit:[86,82],align:'center'}); y+=80; }
      catch(e){ dibujarOjo(doc,w/2,y+32,0.82,rosa,dorado); y+=83; }
    } else { dibujarOjo(doc,w/2,y+32,0.83,rosa,dorado); y+=82; }
    const titulo=limpiar(ticket.nombre_negocio||'LUDAROPE');
    doc.fillColor(rosa).font('Helvetica-Bold').fontSize(titulo.length>18?17:25).text(titulo,12,y,{width:w-24,align:'center'}); y+=34;
    if(ticket.subtitulo) { doc.fillColor(dorado).font('Helvetica-Bold').fontSize(8).text(limpiar(ticket.subtitulo).toUpperCase(),margen,y,{width:cw,align:'center',characterSpacing:1.3}); y+=16; }
    const sucursal=limpiar(venta.nombre_sucursal||venta.sucursal||'');
    if(sucursal) {doc.fillColor(tinta).font('Helvetica').fontSize(9).text(sucursal,margen,y,{width:cw,align:'center'}); y+=14;}
    const rfc=limpiar(ticket.rfc);
    if(ticket.mostrar_rfc && rfc) {doc.fillColor(tinta).font('Helvetica').fontSize(8).text('RFC: '+rfc,margen,y,{width:cw,align:'center'});y+=13;}
    const dir=limpiar(ticket.direccion||venta.direccion_sucursal||'');
    if(ticket.mostrar_direccion && dir) {doc.fillColor(tinta).font('Helvetica').fontSize(8).text(dir,margen,y,{width:cw,align:'center'});y+=doc.heightOfString(dir,{width:cw})+3;}
    if(ticket.mostrar_telefono && ticket.telefono) {doc.fillColor(tinta).fontSize(8).text('TEL. '+limpiar(ticket.telefono),margen,y,{width:cw,align:'center'});y+=14;}
    y+=8;linea(doc,margen,cw,y,rosa);y+=10;
    doc.fillColor(tinta).font('Helvetica').fontSize(9).text(formatearFecha(venta.fecha_venta),margen,y,{width:cw,align:'center'});y+=24;
    const dato=(a,b)=>{doc.font('Helvetica-Bold').fontSize(8).fillColor(rosa).text(a,margen,y,{width:58});doc.font('Helvetica').fillColor(tinta).text(limpiar(b),margen+60,y,{width:cw-60});y+=13;};
    dato('CAJERO:',venta.nombre_cajero||'—'); dato('CAJA:',venta.nombre_caja||'—');dato('FOLIO:',venta.folio||'—');
    y+=9;
    doc.roundedRect(margen-3,y,cw+6,21,6).fillColor('#FBE7ED').fill();
    doc.fillColor(rosa).font('Helvetica-Bold').fontSize(8)
      .text('CANT.',margen,y+6,{width:34}).text('DESCRIPCIÓN',margen+37,y+6,{width:cw-115})
      .text('IMPORTE',w-margen-78,y+6,{width:78,align:'right'});
    y+=28;
    for(const d of detalles) {
      const nombre=limpiar(d.nombre_prenda||d.nombre||`Prenda ${d.id_prenda}`);
      const variacion=[limpiar(d.talla),limpiar(d.color)].filter(Boolean).join(' · ');
      const cantidad=Number(d.cantidad)||1;
      const precio=Number(d.precio_unitario)||0;
      const lineaTotal=Number(d.total_linea??cantidad*precio);
      doc.fillColor(tinta).font('Helvetica').fontSize(9).text(String(cantidad),margen+4,y,{width:28,align:'center'});
      doc.font('Helvetica').fontSize(8.5).text(nombre.toUpperCase(),margen+41,y,{width:cw-119});
      const alturaNombre=doc.heightOfString(nombre.toUpperCase(),{width:cw-119});
      doc.text(mxn(lineaTotal),w-margen-77,y,{width:77,align:'right'});
      y+=Math.max(16,alturaNombre+3);
      if (Number(d.descuento||0)>0) {
        const nombres=(d.promociones_snapshot||[]).map(x=>x.nombre).filter(Boolean).join(', ');
        doc.fillColor('#2D9067').fontSize(7.3).text(`OFERTA${nombres?': '+limpiar(nombres):''} -${mxn(d.descuento)}`,margen+41,y,{width:cw-119});
        y += 13 + (nombres.length>22?13:0);
      }
      if(!compacto && variacion) {doc.fillColor('#786974').fontSize(7.5).text(variacion,margen+41,y,{width:cw-119});y+=13;}
      if(!compacto) { doc.fillColor('#8B7C83').fontSize(7.3).text(`${cantidad} × ${mxn(precio)}`,margen+41,y,{width:cw-119});y+=13; }
      linea(doc,margen+8,cw-16,y+3,'#F6D9E4');y+=11;
    }
    y+=8;
    y=filaMonto(doc,'NO. DE ARTÍCULOS:',String(detalles.reduce((a,d)=>a+Number(d.cantidad||0),0)),y,cw,tinta);
    y=filaMonto(doc,'SUBTOTAL:',mxn(venta.subtotal),y,cw,tinta);
    if(ticket.mostrar_impuesto) y=filaMonto(doc,'IMPUESTO:','No desglosado',y,cw,tinta); // El POS no separa impuesto.
    if(ticket.mostrar_descuento && Number(venta.descuento_total)>0) y=filaMonto(doc,'DESCUENTO:',mxn(venta.descuento_total),y,cw,tinta);
    y+=5;
    doc.roundedRect(margen-3,y,cw+6,28,7).fillColor('#FBE1E9').fill();
    doc.fillColor(rosa).font('Helvetica-Bold').fontSize(16)
      .text('TOTAL:',margen+5,y+5,{width:100}).text(mxn(venta.total),margen+106,y+6,{width:cw-110,align:'right'});
    y+=39;
    const totEfectivo=pagos.filter(p=>p.metodo==='EFECTIVO').reduce((a,p)=>a+Number(p.monto||0),0);
    if (pagos.length) for(const p of pagos) {
      y=filaMonto(doc,limpiar(p.metodo).replace('DEBITO','DÉBITO').replace('CREDITO','CRÉDITO')+':',mxn(p.monto),y,cw,tinta);
    }
    if(totEfectivo && Number(venta.monto_recibido)>0) y=filaMonto(doc,'RECIBIDO:',mxn(venta.monto_recibido),y,cw,tinta);
    if(totEfectivo && Number(venta.cambio)>0) y=filaMonto(doc,'SU CAMBIO:',mxn(venta.cambio),y,cw,tinta);
    if(ticket.mostrar_ahorro && Number(venta.descuento_total)>0) y=filaMonto(doc,'USTED AHORRÓ:',mxn(venta.descuento_total),y,cw,tinta);
    y+=17;
    const mensaje=limpiar(ticket.mensaje_gracias);
    if (mensaje) {
      doc.strokeColor(dorado).moveTo(margen,y+6).lineTo(margen+37,y+6).stroke();
      doc.strokeColor(dorado).moveTo(w-margen-37,y+6).lineTo(w-margen,y+6).stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(rosa).text(mensaje,margen+43,y,{width:cw-86,align:'center'});
      y+=24;
    }
    if(ticket.mensaje_pie) {doc.fillColor(tinta).font('Helvetica').fontSize(8).text(limpiar(ticket.mensaje_pie),margen+8,y,{width:cw-16,align:'center'});y+=26;}
    if(ticket.mostrar_ecologico && ticket.mensaje_ecologico) {
      doc.fillColor('#578362').font('Helvetica-Bold').fontSize(7.5).text(limpiar(ticket.mensaje_ecologico),margen,y,{width:cw,align:'center'}); y+=26;
    }
    doc.fillColor('#988892').fontSize(6.5).text('Comprobante de compra. No sustituye una factura CFDI.',margen,Math.min(h-56,y+5),{width:cw,align:'center'});
    doc.end();
  });
}
async function generarTicketPdf(datos, opciones={}) {
  const config=opciones.ticket ? opciones : await cargarConfiguracion();
  const ticketDatos={...datos, venta:{...datos.venta}};
  if (!ticketDatos.venta.nombre_caja && ticketDatos.venta.id_venta) {
    try {
      const r=await pool.query(`SELECT c.nombre AS nombre_caja
        FROM public.ventas v
        LEFT JOIN public.caja_sesiones cs ON cs.id_sesion=v.id_sesion
        LEFT JOIN public.cajas c ON c.id_caja=cs.id_caja
        WHERE v.id_venta=$1`,[ticketDatos.venta.id_venta]);
      ticketDatos.venta.nombre_caja=r.rows[0]?.nombre_caja || null;
    } catch(err) { /* Compatibilidad con esquemas anteriores sin cajas físicas. */ }
  }
  return construirPdf(ticketDatos,config,config.logo_png,Boolean(opciones.esPrevia));
}
// Isotipo de ojo en formato PNG inline por CID. Gmail/Outlook no dependen
// de enlaces a localhost ni de imágenes externas, y el PDF sigue usando
// su logo configurado o su isotipo vectorial original.
async function logoCorreoPNG(config) {
  if (config.logo_png && Buffer.isBuffer(config.logo_png)) return config.logo_png;
  const p = /^#[a-f\d]{6}$/i.test(config.ticket?.color_primario) ? config.ticket.color_primario : '#FC4D84';
  const o = /^#[a-f\d]{6}$/i.test(config.ticket?.color_secundario) ? config.ticket.color_secundario : '#E7AA44';
  const rayos = Array.from({ length:11 },(_,i)=>{
    const a=(-150+i*12)*Math.PI/180;
    const x1=90+Math.cos(a)*54, y1=64+Math.sin(a)*54;
    const x2=90+Math.cos(a)*69, y2=64+Math.sin(a)*69;
    return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}"/>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="150" viewBox="0 0 180 120">
    <g stroke="${o}" stroke-width="2.5" fill="none" stroke-linecap="round">${rayos}
    <path d="M30 64 Q90 1 150 64 Q90 126 30 64 Z" stroke-width="4"/></g>
    <circle cx="90" cy="64" r="27" fill="${p}"/><circle cx="90" cy="64" r="15" fill="${o}"/><circle cx="90" cy="64" r="7" fill="#FFFFFF"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function datosCompletos(ticket) {
  const copia={venta:ticket.venta, detalles:ticket.detalles, pagos:ticket.pagos};
  // Compatibilidad con la firma existente de posRoutes:
  // enviarTicketPorCorreo({ correo, venta: ticket.venta, pdf }).
  if (Array.isArray(copia.detalles) && Array.isArray(copia.pagos)) return copia;
  const id=Number(ticket.venta?.id_venta);
  if (!Number.isSafeInteger(id) || id<=0) throw new Error('No se pudieron recuperar los datos de la venta para el correo');
  const [det,pag]=await Promise.all([
    pool.query(`SELECT id_prenda,cantidad,precio_unitario,descuento,total_linea,promociones_snapshot,nombre_prenda,talla,color
      FROM public.ventas_detalle WHERE id_venta=$1 ORDER BY id_detalle`,[id]),
    pool.query(`SELECT metodo,monto FROM public.ventas_pagos WHERE id_venta=$1 ORDER BY id_pago`,[id]),
  ]);
  copia.detalles=Array.isArray(copia.detalles)?copia.detalles:det.rows;
  copia.pagos=Array.isArray(copia.pagos)?copia.pagos:pag.rows;
  return copia;
}
async function enviarTicketPorCorreo({ correo, venta, pdf, detalles, pagos, esPrueba=false }) {
  const config = await cargarConfiguracion();
  const conf = config.correo;
  const ticket = await datosCompletos({venta,detalles,pagos});
  const { transport, from } = await transporteCorreo();
  const asunto = esPrueba ? 'VISTA PREVIA · Prueba de ticket digital · LUDAROPE'
    : plantillaTexto(conf.asunto_ticket, venta).replace(/[\r\n]/g, ' ');
  const cuerpoTexto = plantillaTexto(conf.cuerpo_ticket,venta);
  const texto = esPrueba ? 'PRUEBA — NO ES UNA VENTA REAL.\n\n'+cuerpoTexto : cuerpoTexto;
  const adjuntos=[];
  let html;
  if (conf.incluir_ticket_html !== false) {
    if (conf.usar_diseno_ticket !== false) {
      const logo = await logoCorreoPNG(config);
      adjuntos.push({ filename:'ludarope-marca.png',content:logo,contentType:'image/png',cid:'ludarope-logo',contentDisposition:'inline' });
      html=renderTicketEmailHTML(ticket,config,{logoCid:'ludarope-logo',enPrueba:esPrueba});
    } else {
      html=renderCorreoBasico(ticket,config);
    }
  }
  if (conf.adjuntar_pdf !== false) {
    if (!Buffer.isBuffer(pdf) || !pdf.length) throw new Error('No se generó el PDF para adjuntar al correo');
    adjuntos.push({ filename:`${limpiar(venta.folio||'ticket').replace(/[^a-z\d_-]/gi,'_')}.pdf`,content:pdf,contentType:'application/pdf' });
  }
  await transport.sendMail({from,to:correo,subject:asunto,text:texto, ...(html?{html}:{}),attachments:adjuntos});
}
module.exports = { generarTicketPdf, enviarTicketPorCorreo };
