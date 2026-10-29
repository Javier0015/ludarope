'use strict';

// Formateador de email independiente de Express/SMTP; comparte las mismas
// configuraciones y los mismos datos históricos que ticketService (PDF).
const texto = (v) => String(v ?? '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
const htmlSeguro = (v) => texto(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const multilinea = (v) => String(v ?? '').replace(/\r\n?/g, '\n').split('\n').map(htmlSeguro).join('<br>');
const mxn = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const color = (v, alternativa) => /^#[A-F\d]{6}$/i.test(String(v)) ? v : alternativa;
function aclarar(tono, porcentaje = .91) {
  const s = color(tono, '#FC4D84').slice(1);
  return '#' + [0, 2, 4].map(i => Math.round(parseInt(s.slice(i, i+2),16)*(1-porcentaje)+255*porcentaje)
    .toString(16).padStart(2,'0')).join('');
}
function fechaLocal(v) {
  const d = new Date(v || Date.now());
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { timeZone:'America/Mexico_City', dateStyle:'short',timeStyle:'short' }).format(d);
}
function dato(label, contenido, primario) {
  return `<tr><td style="padding:3px 5px;font-size:12px;font-weight:700;color:${primario};width:68px;vertical-align:top">${label}</td><td style="padding:3px 5px;font-size:12px;color:#40323B;overflow-wrap:anywhere">${htmlSeguro(contenido||'—')}</td></tr>`;
}
function importe(label, valor, { destacado=false,colorTexto='#302730' }={}) {
  return `<tr><td style="padding:4px 2px;font-size:${destacado?14:12}px;font-weight:${destacado?800:500};color:${colorTexto}">${label}</td><td align="right" style="padding:4px 2px;font-size:${destacado?17:12}px;font-weight:${destacado?800:600};color:${colorTexto};white-space:nowrap">${htmlSeguro(valor)}</td></tr>`;
}
function plantillaTexto(plantilla, venta) {
  return String(plantilla || '').replace(/\{(folio|total|sucursal)\}/gi, (_, k) => {
    if (k.toLowerCase() === 'folio') return texto(venta.folio);
    if (k.toLowerCase() === 'total') return mxn(venta.total);
    return texto(venta.nombre_sucursal || venta.sucursal || '');
  });
}
function renderTicketEmailHTML({ venta, detalles=[], pagos=[] }, config, { logoCid='ludarope-logo', enPrueba=false }={}) {
  const t = config.ticket || {};
  const p = color(t.color_primario, '#FC4D84');
  const oro = color(t.color_secundario, '#E7AA44');
  const tinta = color(t.color_texto, '#302730');
  const suave = aclarar(p,.89);
  const subtotal = mxn(venta.subtotal);
  const total = mxn(venta.total);
  const compacto = t.formato === 'compacto';
  const filasPrendas = detalles.map(d => {
    const cantidad = Number(d.cantidad) || 0;
    const nombre = htmlSeguro(d.nombre_prenda || d.nombre || `Prenda ${d.id_prenda || ''}`);
    const variacion = [d.talla,d.color].filter(v=>texto(v)).map(htmlSeguro).join(' · ');
    const unitario = mxn(d.precio_unitario);
    const importeLinea = mxn(d.total_linea ?? cantidad*Number(d.precio_unitario||0));
    const lineaDescuento = Number(d.descuento||0)>0 ? `<div style="margin-top:3px;font-size:10px;color:#22865D">Oferta aplicada: −${htmlSeguro(mxn(d.descuento))}</div>` : '';
    return `<tr>
      <td align="center" valign="top" style="border-bottom:1px solid ${aclarar(p,.75)};padding:11px 4px;font-size:12px;color:${tinta}">${cantidad}</td>
      <td valign="top" style="border-bottom:1px solid ${aclarar(p,.75)};padding:11px 6px;font-size:12px;color:${tinta};overflow-wrap:anywhere">
        <strong>${nombre}</strong>${!compacto && variacion ? `<div style="margin-top:3px;color:#8B7481;font-size:10px">${variacion}</div>` : ''}
        ${!compacto ? `<div style="margin-top:3px;color:#8B7481;font-size:10px">${cantidad} × ${htmlSeguro(unitario)}</div>` : ''}${lineaDescuento}
      </td>
      <td align="right" valign="top" style="border-bottom:1px solid ${aclarar(p,.75)};padding:11px 4px;font-size:12px;font-weight:700;color:${tinta};white-space:nowrap">${htmlSeguro(importeLinea)}</td>
    </tr>`;
  }).join('');
  const pagosFilas = pagos.map(g => importe(`${htmlSeguro(String(g.metodo||'').replace('DEBITO','DÉBITO').replace('CREDITO','CRÉDITO'))}:`,mxn(g.monto),{colorTexto:tinta})).join('');
  const hayEfectivo = pagos.some(g=>String(g.metodo).toUpperCase()==='EFECTIVO' && Number(g.monto)>0);
  const promocionesAplicadas = [...new Map(detalles.flatMap(d => d.promociones_snapshot || []).filter(x=>x?.nombre).map(x=>[x.id_promocion,x.nombre])).values()];
  const subtotalRows = [importe('NO. DE ARTÍCULOS:',String(detalles.reduce((a,d)=>a+Number(d.cantidad||0),0)),{colorTexto:tinta}),importe('SUBTOTAL:',subtotal,{colorTexto:tinta})];
  if(t.mostrar_impuesto) subtotalRows.push(importe('IMPUESTO:','No desglosado',{colorTexto:tinta}));
  if(t.mostrar_descuento && Number(venta.descuento_total)>0) subtotalRows.push(importe('DESCUENTO:',mxn(venta.descuento_total),{colorTexto:tinta}));
  const pagadoRows = [pagosFilas];
  if (hayEfectivo && Number(venta.monto_recibido)>0) pagadoRows.push(importe('RECIBIDO:',mxn(venta.monto_recibido),{colorTexto:tinta}));
  if (hayEfectivo && Number(venta.cambio)>0) pagadoRows.push(importe('SU CAMBIO:',mxn(venta.cambio),{colorTexto:tinta}));
  if (t.mostrar_ahorro && Number(venta.descuento_total)>0) pagadoRows.push(importe('USTED AHORRÓ:',mxn(venta.descuento_total),{colorTexto:tinta}));
  const direccion = t.direccion || venta.direccion_sucursal || '';
  const sucursal = texto(venta.nombre_sucursal || venta.sucursal || '');
  const logo = logoCid ? `<img src="cid:${logoCid}" alt="Logo de ${htmlSeguro(t.nombre_negocio || 'LUDAROPE')}" width="108" style="display:block;max-width:108px;max-height:98px;width:auto;height:auto;margin:0 auto;border:0"/>` : '';
  const pie = t.mensaje_pie ? `<div style="font-size:11px;color:${tinta};text-align:center;line-height:1.6;margin-top:9px">${multilinea(t.mensaje_pie)}</div>` : '';
  const frase = t.mostrar_ecologico && t.mensaje_ecologico ? `<div style="margin-top:15px;font-size:11px;color:#538665;text-align:center;line-height:1.6">&#127807; ${multilinea(t.mensaje_ecologico)}</div>` : '';
  const mensajeCuerpo = plantillaTexto(config.correo?.cuerpo_ticket, venta);
  const mensajeIntro = mensajeCuerpo ? `<div style="max-width:460px;margin:0 auto 20px;padding:0 14px;font-size:13px;color:#735A69;line-height:1.65;text-align:center">${multilinea(mensajeCuerpo)}</div>` : '';
  const bandaPrueba = enPrueba ? `<div style="background:#FFF3D7;color:#8F641B;padding:12px;text-align:center;font-size:12px;font-weight:bold">PRUEBA DE CONFIGURACIÓN — NO ES UNA COMPRA REAL</div>` : '';
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Comprobante digital ${htmlSeguro(venta.folio)}</title></head>
  <body style="margin:0;padding:0;background:#F6F2F5;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
   <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F6F2F5"><tr><td align="center" style="padding:30px 12px">
    ${mensajeIntro}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:460px;background:#FFFFFF;border:1px solid #EDDCE4;border-radius:18px;overflow:hidden">
     ${enPrueba ? `<tr><td>${bandaPrueba}</td></tr>`:''}
     <tr><td style="padding:0"><div style="height:8px;background:${p};border-top:3px solid ${oro}"></div></td></tr>
     <tr><td style="padding:24px 24px 12px">
      <div style="text-align:center">${logo}</div>
      <div style="font-size:29px;font-weight:800;letter-spacing:5px;color:${p};text-align:center;margin-top:8px;overflow-wrap:anywhere">${htmlSeguro(t.nombre_negocio||'LUDAROPE')}</div>
      ${t.subtitulo ? `<div style="font-size:10px;font-weight:700;letter-spacing:3px;color:${oro};text-align:center;margin-top:4px">${htmlSeguro(t.subtitulo).toUpperCase()}</div>`:''}
      ${sucursal ? `<div style="font-size:12px;color:${tinta};text-align:center;margin-top:12px">${htmlSeguro(sucursal)}</div>`:''}
      ${t.mostrar_rfc && t.rfc?`<div style="font-size:11px;color:${tinta};text-align:center;margin-top:4px">RFC: ${htmlSeguro(t.rfc)}</div>`:''}
      ${t.mostrar_direccion && direccion?`<div style="font-size:11px;color:${tinta};text-align:center;margin-top:4px">${htmlSeguro(direccion)}</div>`:''}
      ${t.mostrar_telefono && t.telefono?`<div style="font-size:11px;color:${tinta};text-align:center;margin-top:4px">TEL. ${htmlSeguro(t.telefono)}</div>`:''}
      <div style="margin-top:16px;border-top:2px solid ${p}"></div>
      <div style="font-size:12px;text-align:center;color:${tinta};margin:12px 0 8px">${htmlSeguro(fechaLocal(venta.fecha_venta))}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${dato('CAJERO:',venta.nombre_cajero,p)}${dato('CAJA:',venta.nombre_caja,p)}${dato('FOLIO:',venta.folio,p)}</table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;border-collapse:collapse;table-layout:fixed">
       <thead><tr style="background:${suave}"><th align="center" width="14%" style="padding:11px 4px;font-size:10px;color:${p}">CANT.</th><th align="left" width="57%" style="padding:11px 6px;font-size:10px;color:${p}">DESCRIPCIÓN</th><th align="right" width="29%" style="padding:11px 4px;font-size:10px;color:${p}">IMPORTE</th></tr></thead>
       <tbody>${filasPrendas || `<tr><td colspan="3" style="font-size:12px;text-align:center;padding:14px">Sin prendas en esta vista</td></tr>`}</tbody>
      </table>
      ${promocionesAplicadas.length ? `<div style="margin-top:12px;font-size:10px;color:${p};font-weight:bold">PROMOCIONES: ${promocionesAplicadas.map(htmlSeguro).join(' · ')}</div>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:13px">${subtotalRows.join('')}</table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:10px;background:${suave};border-radius:8px"><tr>${importe('TOTAL:',total,{destacado:true,colorTexto:p}).replace(/^<tr>/,'').replace(/<\/tr>$/,'')}</tr></table>
      ${pagadoRows.join('') ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px">${pagadoRows.join('')}</table>` : ''}
      ${t.mensaje_gracias?`<div style="text-align:center;color:${p};font-size:12px;letter-spacing:2px;font-weight:800;border-top:1px solid ${oro};margin-top:20px;padding-top:14px">${htmlSeguro(t.mensaje_gracias)}</div>`:''}
      ${pie}${frase}
      <div style="font-size:10px;color:#9D8C95;text-align:center;line-height:1.5;margin-top:14px">${config.correo?.adjuntar_pdf !== false ? 'Tu comprobante también está adjunto en PDF.' : 'Conserva este correo como comprobante de compra.'}</div>
      <div style="font-size:9px;color:#A998A2;text-align:center;margin-top:10px">Comprobante de compra. No sustituye una factura CFDI.</div>
     </td></tr>
     <tr><td><div style="height:10px;background:${aclarar(p,.65)};border-bottom:3px solid ${oro}"></div></td></tr>
    </table>
    <div style="max-width:440px;text-align:center;font-size:11px;color:#998392;line-height:1.6;padding:16px">LUDAROPE · Comprobante digital · Menos papel, más estilo</div>
   </td></tr></table>
  </body></html>`;
}
function renderCorreoBasico({ venta }, config) {
  const mensaje = plantillaTexto(config.correo?.cuerpo_ticket,venta);
  return `<html lang="es"><body style="font-family:Arial,sans-serif;background:#FFF8FA;padding:28px;color:#302730"><div style="max-width:520px;background:white;margin:auto;padding:25px;border:1px solid #F2DDE5;border-radius:12px"><h2 style="color:#FC4D84">LUDAROPE</h2><p>${multilinea(mensaje)}</p><p style="font-size:12px">Folio: ${htmlSeguro(venta.folio)} · Total: ${htmlSeguro(mxn(venta.total))}</p></div></body></html>`;
}
module.exports = { renderTicketEmailHTML, renderCorreoBasico, plantillaTexto, htmlSeguro, mxn };
