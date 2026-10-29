'use strict';
const PDFDocument = require('pdfkit');

const P={pink:'#FC4D84',coral:'#FE714B',gold:'#E7AA44',ink:'#332832',muted:'#806F79',line:'#F1DEE5',light:'#FFF6F9',mint:'#17845E',white:'#FFFFFF'};
const dinero=(v)=>Number(v||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const fecha=(f)=>f?new Date(f).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}):'—';
const hora=(f)=>f?new Date(f).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Mexico_City'}):'—';
const valor=(v)=>v==null?'—':String(v);

/** Corte de caja, A4 y multipágina; ventas + cancelaciones + efectivo, sin costos privados. */
function generarCorteCajaPdf({sesion,resumen,ventas=[],movimientos=[],actividad=[]}){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({autoFirstPage:false,size:'A4',margin:0,bufferPages:true,
      info:{Title:`LUDAROPE - Corte de caja ${sesion.id_sesion}`,Subject:'Reporte digital interno y conciliación de caja'}});
    const chunks=[];doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    const M=43,W=509,BOTTOM=778;
    let y=0;
    const txt=(t,x,yy,w,opts={})=>{
      const {font='Helvetica',size=9,color=P.ink,align='left',...rest}=opts;
      doc.font(font).fontSize(size).fillColor(color).text(valor(t),x,yy,{width:w,align,...rest});
    };
    function header(primera){
      doc.rect(0,0,595,primera?128:75).fill(P.ink);
      doc.rect(0,0,595,7).fill(P.pink);
      doc.rect(459,7,136,5).fill(P.gold);
      // Insignia geométrica inspirada en el ojo de LUDAROPE.
      const cx=70,cy=primera?63:37;
      doc.save().lineWidth(1.7).strokeColor(P.gold).moveTo(cx-16,cy).bezierCurveTo(cx-7,cy-12,cx+8,cy-12,cx+17,cy).bezierCurveTo(cx+8,cy+12,cx-7,cy+12,cx-16,cy).stroke();
      doc.circle(cx,cy,6).fill(P.pink);doc.circle(cx,cy,2.5).fill(P.white);doc.restore();
      txt('L U D A R O P E',103,primera?36:23,300,{font:'Helvetica-Bold',size:20,color:P.white});
      txt(primera?'CORTE DIGITAL DE CAJA':'REPORTE DE CORTE · CONTINUACIÓN',103,primera?73:50,360,{font:'Helvetica-Bold',size:10,color:'#F2D3DE'});
      if(primera)txt(`SESIÓN #${sesion.id_sesion}`,423,46,128,{font:'Helvetica-Bold',size:11,align:'right',color:P.white});
      y=primera?147:97;
    }
    function nuevaPagina(primera=false){doc.addPage();header(primera);}
    function espacio(alto){if(y+alto>BOTTOM)nuevaPagina(false);}
    function seccion(t,descripcion=''){
      espacio(descripcion?53:37);
      doc.roundedRect(M,y,W,26,7).fill(P.light);
      doc.rect(M,y,4,26).fill(P.pink);
      txt(t,M+13,y+7,W-28,{font:'Helvetica-Bold',size:11,color:P.ink});y+=34;
      if(descripcion){txt(descripcion,M,y,W,{size:8,color:P.muted});y+=17;}
    }
    function linea(k,v,{resaltar=false,color}={}){
      espacio(24);
      if(resaltar)doc.roundedRect(M,y-3,W,24,5).fill(P.light);
      txt(k,M+(resaltar?10:3),y+2,316,{size:9,font:resaltar?'Helvetica-Bold':'Helvetica',color:resaltar?P.ink:P.muted});
      txt(v,M+327,y+2,172,{font:'Helvetica-Bold',size:9,align:'right',color:color||P.ink});
      if(!resaltar)doc.moveTo(M,y+22).lineTo(M+W,y+22).strokeColor('#F6EDF0').lineWidth(.6).stroke();
      y+=25;
    }
    function tarjeta(x,width,label,value,accent=P.pink){
      doc.roundedRect(x,y,width,59,10).fill(P.light);
      doc.rect(x,y,4,59).fill(accent);
      txt(label.toUpperCase(),x+12,y+10,width-24,{size:7.5,color:P.muted,font:'Helvetica-Bold'});
      txt(value,x+12,y+28,width-24,{size:15,color:P.ink,font:'Helvetica-Bold',ellipsis:true});
    }
    function tablaTitulo(columnas,anchos){
      espacio(34);doc.roundedRect(M,y,W,28,5).fill('#FDEBF1');
      let x=M+9;
      columnas.forEach((c,i)=>{txt(c,x,y+8,anchos[i]-6,{font:'Helvetica-Bold',size:8,color:P.ink});x+=anchos[i];});
      y+=31;
    }
    function filaTabla(columnas,anchos,config={}){
      const alturas=columnas.map((c,i)=>doc.font(i===0?'Helvetica-Bold':'Helvetica').fontSize(8).heightOfString(valor(c),{width:anchos[i]-9}));
      const h=Math.max(29,Math.min(83,Math.max(...alturas)+13));
      espacio(h+1);
      if(config.fondo)doc.roundedRect(M,y,W,h,4).fill(config.fondo);
      let x=M+9;
      columnas.forEach((c,i)=>{txt(c,x,y+7,anchos[i]-9,{font:i===0?'Helvetica-Bold':'Helvetica',size:8,color:(config.cancelado&&i===0)?'#B9485A':P.ink,height:h-10,ellipsis:true});x+=anchos[i];});
      if(!config.fondo)doc.moveTo(M,y+h).lineTo(M+W,y+h).lineWidth(.5).strokeColor(P.line).stroke();
      y+=h+1;
    }

    nuevaPagina(true);
    // Ficha de turno
    doc.roundedRect(M,y,W,102,11).fill('#FFF9FB');
    txt('Sucursal',M+13,y+12,72,{size:8,color:P.muted});
    txt(sesion.sucursal || '—',M+89,y+12,390,{size:10,font:'Helvetica-Bold'});
    txt('Caja',M+13,y+34,72,{size:8,color:P.muted});
    txt(sesion.caja || '—',M+89,y+34,390,{size:9,font:'Helvetica-Bold'});
    txt('Cajero',M+13,y+55,72,{size:8,color:P.muted});
    txt(sesion.cajero || '—',M+89,y+55,390,{size:9,font:'Helvetica-Bold'});
    txt(`Apertura: ${fecha(sesion.fecha_apertura)}`,M+13,y+80,246,{size:8,color:P.muted});
    txt(`Cierre: ${fecha(sesion.fecha_cierre)}`,M+264,y+80,236,{size:8,color:P.muted});
    y+=116;

    espacio(71);
    const miniGap=8,miniW=(W-3*miniGap)/4;
    tarjeta(M,miniW,'Total vendido',dinero(resumen.ventas_total));
    tarjeta(M+miniW+miniGap,miniW,'Operaciones',String(resumen.numero_ventas || 0),P.coral);
    tarjeta(M+2*(miniW+miniGap),miniW,'Efec. esperado',dinero(resumen.efectivo_esperado),P.gold);
    tarjeta(M+3*(miniW+miniGap),miniW,'Diferencia',dinero(resumen.diferencia),Number(resumen.diferencia)===0?P.mint:P.coral);
    y+=72;

    seccion('Cobros del turno','Solo ventas completadas. Los cobros mixtos se separan por método.');
    linea('Efectivo',dinero(resumen.ventas_efectivo));
    linea('Tarjeta de débito',dinero(resumen.ventas_debito));
    linea('Tarjeta de crédito',dinero(resumen.ventas_credito));
    linea('Transferencia',dinero(resumen.ventas_transferencia));
    linea('Descuentos en promociones',dinero(resumen.descuentos_promociones));
    linea('Ventas netas completadas',dinero(resumen.ventas_total),{resaltar:true});

    seccion('Conciliación de efectivo');
    linea('Fondo inicial',dinero(sesion.monto_inicial));
    linea('Ventas pagadas en efectivo',dinero(resumen.ventas_efectivo));
    linea('Entradas / ajustes positivos',dinero(resumen.entradas_efectivo));
    linea('Salidas / gastos / retiros',`-${dinero(resumen.salidas_efectivo)}`);
    linea('Efectivo esperado',dinero(resumen.efectivo_esperado),{resaltar:true});
    linea('Efectivo contado',resumen.efectivo_contado===null?'Sin conteo':dinero(resumen.efectivo_contado));
    linea('Diferencia del corte',resumen.diferencia===null?'—':dinero(resumen.diferencia),{resaltar:true,color:Number(resumen.diferencia)===0?P.mint:P.coral});

    const todas=ventas || [];
    seccion('Ventas del turno',`${todas.length} registro(s) asociados a esta sesión; las canceladas se señalan y no suman al cobro neto.`);
    if(!todas.length){espacio(34);txt('No existen ventas asociadas a esta sesión de caja.',M+4,y+8,W-8,{size:9,color:P.muted});y+=34;}
    else {
      const anchos=[91,77,186,83,72];
      tablaTitulo(['FOLIO','FECHA','PRENDAS','PAGOS','TOTAL'],anchos);
      for(const v of todas){
        const cancelado=v.estado==='CANCELADA';
        filaTabla([v.folio,hora(v.fecha_venta),v.prendas,`${v.pagos}${cancelado?' · CANCELADA':''}`,dinero(v.total)],anchos,{fondo:cancelado?'#FFF0F1':null,cancelado});
      }
    }

    seccion('Movimientos cronológicos',`Ventas, cancelaciones y movimientos de efectivo ordenados por fecha. ${actividad.length} evento(s).`);
    if(!actividad.length){espacio(31);txt('No hay movimientos en este turno.',M+4,y+6,W-8,{color:P.muted});y+=28;}
    else {
      // La columna "Efectivo +/-" es informativa, NO se suma otra vez al resumen de cierre.
      const anchos=[80,87,194,79,69];
      tablaTitulo(['FECHA','TIPO','DETALLE / REF.','MONTO','EFECTIVO +/-'],anchos);
      for(const a of actividad){
        const signo=a.importe_signo<0?'-':'+';
        const cash=Number(a.impacto_efectivo||0);
        const efectivo=`${cash>0?'+':''}${dinero(cash)}`;
        const detalle=[a.folio,a.concepto].filter(Boolean).join(' · ');
        filaTabla([hora(a.fecha),a.tipo.replaceAll('_',' '),detalle,`${signo}${dinero(a.monto)}`,efectivo],anchos,{fondo:a.clase==='CANCELACION'?'#FFF0F1':null,cancelado:a.clase==='CANCELACION'});
      }
      espacio(26);
      txt('Nota: los reversos de ventas canceladas se muestran solo para auditoría; su importe ya se excluyó del resumen.',M,y,W,{size:7.5,color:P.muted});y+=26;
    }
    if(sesion.observaciones){seccion('Observaciones del cierre'); const hh=doc.font('Helvetica').fontSize(9).heightOfString(sesion.observaciones,{width:W-12});espacio(hh+14);txt(sesion.observaciones,M+6,y+5,W-12,{size:9,color:P.muted});y+=hh+14;}

    const rango=doc.bufferedPageRange();
    for(let i=rango.start;i<rango.start+rango.count;i++){
      doc.switchToPage(i);
      doc.moveTo(M,801).lineTo(M+W,801).strokeColor(P.line).lineWidth(.8).stroke();
      txt('LUDAROPE  •  Reporte digital interno  •  Sin impresión obligatoria',M,812,430,{size:7.5,color:P.muted});
      txt(`${i-rango.start+1} / ${rango.count}`,M+436,812,73,{size:8,color:P.muted,align:'right'});
    }
    doc.end();
  });
}
module.exports={generarCorteCajaPdf};
