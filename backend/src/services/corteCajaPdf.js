'use strict';

/**
 * LUDAROPE POS · Corte de caja, diseño EDITORIAL / BOUTIQUE.
 * Sustituye al generador anterior sin modificar su firma ni el endpoint.
 * Requiere: npm install pdfkit
 *
 * Paleta oficial: #FEFEFE, #FC4D84, #FE714B, #FF751F, #E7AA44.
 * Logo oficial cargado desde ./img/logo.jpg (sin duplicar la imagen).
 * Fuentes integradas de PDFKit (sin dependencias adicionales de tipografía).
 * Todos los importes y totales proceden del resumen calculado por el backend.
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Ruta relativa a este mismo servicio: backend/src/services/img/logo.jpg
// El archivo se toma directamente de tu proyecto al generar cada PDF.
const RUTA_LOGO = path.join(__dirname, 'img', 'logo.jpg');

const P = {
  blanco: '#FEFEFE', rosa: '#FC4D84', coral: '#FE714B',
  naranja: '#FF751F', oro: '#E7AA44',
  tinta: '#342B32', secundaria: '#806D78', linea: '#EFDFE5',
  suave: '#FFF7FA', suaveRosa: '#FFF0F5', crema: '#FFFAF5',
  verde: '#187A57', verdeClaro: '#EDF8F3', alerta: '#A64948',
};

const dinero = (v) => Number(v || 0).toLocaleString('es-MX', {
  style: 'currency', currency: 'MXN',
});
const valor = (v) => v === undefined || v === null ? '—' : String(v);
const fecha = (f) => f ? new Date(f).toLocaleString('es-MX', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City',
}) : '—';
const hora = (f) => f ? new Date(f).toLocaleString('es-MX', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Mexico_City',
}) : '—';

/** Corte A4, multipágina, con ventas, cancelaciones, conciliación y auditoría. */
function generarCorteCajaPdf({ sesion, resumen, ventas = [], movimientos = [], actividad = [] }) {
  return new Promise((resolve, reject) => {
    if (!sesion || !resumen) {
      reject(new Error('El corte requiere sesion y resumen.'));
      return;
    }

    const doc = new PDFDocument({
      size: 'A4', margin: 0, autoFirstPage: false, bufferPages: true,
      info: {
        Title: `LUDAROPE - Corte de caja ${sesion.id_sesion}`,
        Subject: 'Cierre y conciliación de caja - reporte interno',
        Author: 'LUDAROPE POS',
      },
    });
    const buffers = [];
    doc.on('data', (parte) => buffers.push(parte));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const PAGINA = { w: 595.28, h: 841.89 };
    const M = 43;
    const W = PAGINA.w - 2 * M;
    const LIMITE = 774;
    let y = 0;

    function texto(t, x, posY, ancho, opciones = {}) {
      const {
        fuente = 'Helvetica', tamano = 9, color = P.tinta,
        alineacion = 'left', ...resto
      } = opciones;
      doc.font(fuente).fontSize(tamano).fillColor(color)
        .text(valor(t), x, posY, {
          width: ancho, align: alineacion, ...resto,
        });
    }

    function caja(x, posY, ancho, alto, fill = P.blanco, radio = 10, borde) {
      doc.roundedRect(x, posY, ancho, alto, radio)
        .fillColor(fill).fill();
      if (borde) doc.roundedRect(x, posY, ancho, alto, radio)
        .lineWidth(0.8).strokeColor(borde).stroke();
    }

    function raya(x1, yy, x2, color = P.linea, grosor = 0.8) {
      doc.moveTo(x1, yy).lineTo(x2, yy).lineWidth(grosor).strokeColor(color).stroke();
    }

    function marcaOjo(cx, cy) {
      // Identidad geométrica inspirada en LUDAROPE, trazada en vectores.
      doc.save();
      doc.moveTo(cx - 16, cy)
        .bezierCurveTo(cx - 7, cy - 11, cx + 7, cy - 11, cx + 16, cy)
        .bezierCurveTo(cx + 7, cy + 11, cx - 7, cy + 11, cx - 16, cy)
        .strokeColor(P.oro).lineWidth(1.6).stroke();
      doc.circle(cx, cy, 6.3).fill(P.rosa);
      doc.circle(cx, cy, 2.4).fill(P.blanco);
      doc.restore();
    }

    function colocarLogo(x, posY, ancho, alto) {
      // Conserva una marca vectorial de respaldo si la imagen no está disponible.
      // PDFKit incorpora el JPEG directamente en el PDF generado.
      if (fs.existsSync(RUTA_LOGO)) {
        try {
          doc.image(RUTA_LOGO, x, posY, {
            fit: [ancho, alto],
            align: 'center', valign: 'center',
          });
          return;
        } catch (err) {
          console.warn('LUDAROPE: no se pudo insertar el logo del corte:', err.message);
        }
      }
      marcaOjo(x + ancho / 2, posY + alto / 2);
    }

    function cabecera(primera) {
      doc.rect(0, 0, PAGINA.w, PAGINA.h).fill(P.blanco);
      doc.rect(0, 0, PAGINA.w, 5).fill(P.oro);
      doc.rect(0, 5, 126, 3).fill(P.rosa);
      // Logo oficial, junto al nombre en todas las páginas.
      colocarLogo(M - 1, primera ? 21 : 14, 45, 52);
      texto('L U D A R O P E', M + 53, primera ? 37 : 30, 260, {
        fuente: 'Times-Bold', tamano: 20, color: P.tinta,
      });
      texto('POS  /  REPORTE INTERNO', M + 54, primera ? 63 : 56, 276, {
        fuente: 'Helvetica-Bold', tamano: 7, color: P.rosa, characterSpacing: 1.4,
      });
      texto(`SESIÓN  ${valor(sesion.id_sesion)}`, PAGINA.w - M - 154, primera ? 46 : 38, 154, {
        fuente: 'Helvetica-Bold', tamano: 9, color: P.secundaria, alineacion: 'right',
      });
      if (!primera) {
        raya(M, 83, M + W, P.linea, 1);
        y = 101;
      } else {
        // Banner editorial, intencionalmente sin fondo oscuro.
        caja(M, 99, W, 103, P.suaveRosa, 13);
        doc.rect(M, 99, 6, 103).fill(P.rosa);
        texto('CIERRE  /  CONCILIACIÓN', M + 19, 113, 355, {
          fuente: 'Helvetica-Bold', tamano: 8, color: P.rosa, characterSpacing: 1.1,
        });
        texto('Corte de caja', M + 18, 131, 362, {
          fuente: 'Times-Bold', tamano: 30, color: P.tinta,
        });
        texto('Resumen financiero y actividad del turno', M + 20, 174, 357, {
          tamano: 8.8, color: P.secundaria,
        });
        // Sello editorial con el logotipo oficial en lugar del ojo esquemático.
        const insigniaX = M + W - 97;
        caja(insigniaX, 110, 87, 82, P.blanco, 15, P.oro);
        colocarLogo(insigniaX + 9, 116, 69, 69);
        y = 219;
      }
    }

    function nuevaPagina(primera = false) {
      doc.addPage();
      cabecera(primera);
    }
    function espacio(necesario = 30) {
      if (y + necesario > LIMITE) nuevaPagina(false);
    }

    function etiqueta(t, x, yy, ancho) {
      texto(t.toUpperCase(), x, yy, ancho, {
        fuente: 'Helvetica-Bold', tamano: 7, color: P.secundaria,
      });
    }
    function ficha() {
      espacio(99);
      caja(M, y, W, 92, P.blanco, 11, P.linea);
      const mitad = W / 2;
      doc.moveTo(M + mitad, y + 13).lineTo(M + mitad, y + 79)
        .lineWidth(0.7).strokeColor(P.linea).stroke();
      etiqueta('Sucursal', M + 15, y + 13, 200);
      texto(sesion.sucursal || '—', M + 15, y + 28, mitad - 29, {
        fuente: 'Helvetica-Bold', tamano: 11, height: 17, ellipsis: true,
      });
      etiqueta('Caja / responsable', M + mitad + 15, y + 13, 200);
      texto(sesion.caja || '—', M + mitad + 15, y + 28, mitad - 29, {
        fuente: 'Helvetica-Bold', tamano: 10.5, height: 17, ellipsis: true,
      });
      texto(sesion.cajero || '—', M + mitad + 15, y + 46, mitad - 29, {
        tamano: 8, color: P.secundaria, height: 14, ellipsis: true,
      });
      raya(M + 14, y + 65, M + W - 14, P.linea);
      texto(`ABRIÓ: ${fecha(sesion.fecha_apertura)}`, M + 15, y + 73, mitad - 28, {
        fuente: 'Helvetica-Bold', tamano: 7, color: P.secundaria,
      });
      texto(`CERRÓ: ${fecha(sesion.fecha_cierre)}`, M + mitad + 15, y + 73, mitad - 28, {
        fuente: 'Helvetica-Bold', tamano: 7, color: P.secundaria,
      });
      y += 107;
    }

    function indicadores() {
      espacio(87);
      const gap = 8;
      const ancho = (W - gap * 3) / 4;
      const datos = [
        ['TOTAL VENDIDO', dinero(resumen.ventas_total), P.rosa],
        ['OPERACIONES', String(resumen.numero_ventas || 0), P.coral],
        ['EFEC. ESPERADO', dinero(resumen.efectivo_esperado), P.oro],
        ['DIFERENCIA', resumen.diferencia == null ? 'Sin conteo' : dinero(resumen.diferencia),
          resumen.diferencia == null ? P.oro : Number(resumen.diferencia) === 0 ? P.verde : P.coral],
      ];
      datos.forEach(([nombre, cantidad, acento], indice) => {
        const x = M + indice * (ancho + gap);
        caja(x, y, ancho, 76, P.blanco, 10, P.linea);
        doc.roundedRect(x + 11, y + 11, 18, 4, 2).fill(acento);
        etiqueta(nombre, x + 11, y + 23, ancho - 20);
        texto(cantidad, x + 11, y + 44, ancho - 20, {
          fuente: 'Helvetica-Bold', tamano: cantidad.length > 13 ? 10.4 : cantidad.length > 9 ? 12 : 15,
          color: P.tinta, height: 19, ellipsis: true,
        });
      });
      y += 91;
    }

    function seccion(numero, titulo, detalle = '', minimo = 42) {
      espacio(minimo + (detalle ? 15 : 0));
      texto(numero, M, y + 1, 39, {
        fuente: 'Times-Bold', tamano: 21, color: P.oro,
      });
      texto(titulo, M + 39, y + 3, W - 40, {
        fuente: 'Times-Bold', tamano: 16.5, color: P.tinta,
      });
      y += 29;
      raya(M, y, M + W, P.linea, 0.8);
      y += 10;
      if (detalle) {
        texto(detalle, M + 3, y, W - 6, {
          tamano: 8, color: P.secundaria, height: 25,
        });
        y += 19;
      }
    }

    function concepto(descripcion, monto, { fuerte = false, color = P.tinta } = {}) {
      espacio(fuerte ? 33 : 24);
      if (fuerte) caja(M, y, W, 31, P.suaveRosa, 6);
      texto(descripcion, M + (fuerte ? 13 : 3), y + (fuerte ? 9 : 5), 315, {
        fuente: fuerte ? 'Helvetica-Bold' : 'Helvetica', tamano: 9,
        color: fuerte ? P.tinta : P.secundaria,
      });
      texto(monto, M + 330, y + (fuerte ? 8 : 4), 167, {
        fuente: 'Helvetica-Bold', tamano: fuerte ? 10.5 : 9.5,
        color, alineacion: 'right',
      });
      if (!fuerte) raya(M + 3, y + 23, M + W - 3, '#F4E9EE', 0.55);
      y += fuerte ? 39 : 26;
    }

    function nota(textoNota, tono = P.secundaria) {
      const h = doc.font('Helvetica').fontSize(8).heightOfString(String(textoNota), {
        width: W - 20,
      });
      espacio(h + 23);
      caja(M, y, W, h + 18, P.crema, 6);
      doc.rect(M, y, 3, h + 18).fill(P.oro);
      texto(textoNota, M + 10, y + 8, W - 20, {
        tamano: 8, color: tono,
      });
      y += h + 28;
    }

    function cabeceraTabla(columnas) {
      espacio(33);
      caja(M, y, W, 29, P.suaveRosa, 5);
      let x = M;
      for (const col of columnas) {
        texto(col.label, x + 8, y + 10, col.w - 13, {
          fuente: 'Helvetica-Bold', tamano: 7.4, color: P.rosa,
          alineacion: col.align || 'left', height: 14,
        });
        x += col.w;
      }
      y += 32;
    }
    function filaTabla(celdas, columnas, { cancelada = false, destacado = false } = {}) {
      const alturas = celdas.map((celda, i) => doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8).heightOfString(valor(celda), {
          width: columnas[i].w - 16,
        }));
      const h = Math.max(32, Math.min(55, Math.max(...alturas) + 12));
      if (y + h > LIMITE) cabeceraTablaEnNuevaPagina(columnas);
      if (cancelada) caja(M, y, W, h - 1, '#FFF1EF', 4);
      else if (destacado) caja(M, y, W, h - 1, P.crema, 4);
      let x = M;
      celdas.forEach((celda, i) => {
        texto(celda, x + 8, y + 9, columnas[i].w - 15, {
          fuente: i === 0 ? 'Helvetica-Bold' : 'Helvetica',
          tamano: 8, color: cancelada && i === 0 ? P.alerta : P.tinta,
          alineacion: columnas[i].align || 'left', height: h - 13, ellipsis: true,
        });
        x += columnas[i].w;
      });
      if (!cancelada && !destacado) raya(M, y + h - 1, M + W, P.linea, 0.6);
      y += h + 1;
    }
    function cabeceraTablaEnNuevaPagina(columnas) {
      nuevaPagina(false);
      cabeceraTabla(columnas);
    }

    nuevaPagina(true);
    ficha();
    indicadores();

    seccion('01', 'Cobros del turno', 'Ventas completadas. Los pagos mixtos están desglosados por método.', 210);
    concepto('Efectivo', dinero(resumen.ventas_efectivo));
    concepto('Tarjeta de débito', dinero(resumen.ventas_debito));
    concepto('Tarjeta de crédito', dinero(resumen.ventas_credito));
    concepto('Transferencia', dinero(resumen.ventas_transferencia));
    concepto('Descuentos y promociones', dinero(resumen.descuentos_promociones));
    concepto('VENTAS NETAS', dinero(resumen.ventas_total), { fuerte: true });

    seccion('02', 'Conciliación de efectivo', 'Comparación entre efectivo esperado y el conteo realizado.', 205);
    concepto('Fondo de apertura', dinero(sesion.monto_inicial));
    concepto('Ventas en efectivo', dinero(resumen.ventas_efectivo));
    concepto('Entradas / ajustes positivos', dinero(resumen.entradas_efectivo));
    concepto('Salidas, retiros y gastos', `-${dinero(resumen.salidas_efectivo)}`);
    concepto('EFECTIVO ESPERADO', dinero(resumen.efectivo_esperado), { fuerte: true });
    concepto('Efectivo contado', resumen.efectivo_contado == null ? 'Sin conteo' : dinero(resumen.efectivo_contado));
    concepto('DIFERENCIA', resumen.diferencia == null ? '—' : dinero(resumen.diferencia), {
      fuerte: true,
      color: resumen.diferencia != null && Number(resumen.diferencia) === 0 ? P.verde : P.alerta,
    });

    const ventasTurno = Array.isArray(ventas) ? ventas : [];
    seccion('03', 'Ventas registradas',
      `${ventasTurno.length} registro(s). Las canceladas se muestran para auditoría y no suman al ingreso neto.`, 116);
    if (!ventasTurno.length) {
      nota('Esta sesión no tiene ventas asociadas.');
    } else {
      const colsVentas = [
        { label: 'FOLIO', w: 97 }, { label: 'FECHA', w: 79 },
        { label: 'PRENDAS', w: 137 }, { label: 'PAGO / ESTADO', w: 113 },
        { label: 'IMPORTE', w: W - 426, align: 'right' },
      ];
      cabeceraTabla(colsVentas);
      ventasTurno.forEach((v) => {
        const cancelada = v.estado === 'CANCELADA';
        filaTabla([
          v.folio, hora(v.fecha_venta), v.prendas,
          `${valor(v.pagos)}${cancelada ? '\nCANCELADA' : ''}`, dinero(v.total),
        ], colsVentas, { cancelada });
      });
    }

    const eventos = Array.isArray(actividad) ? actividad : [];
    seccion('04', 'Bitácora de movimientos',
      `${eventos.length} evento(s). Operaciones en orden cronológico, incluidas las cancelaciones.`, 116);
    if (!eventos.length) nota('No se registraron movimientos durante el turno.');
    else {
      const colsEventos = [
        { label: 'FECHA', w: 79 }, { label: 'TIPO', w: 87 },
        { label: 'DETALLE / REFERENCIA', w: 158 },
        { label: 'MONTO', w: 91, align: 'right' },
        { label: 'EFECTIVO +/-', w: W - 415, align: 'right' },
      ];
      cabeceraTabla(colsEventos);
      eventos.forEach((a) => {
        const signo = Number(a.importe_signo) < 0 ? '-' : '+';
        const cash = Number(a.impacto_efectivo || 0);
        filaTabla([
          hora(a.fecha), valor(a.tipo).replaceAll('_', ' '),
          [a.folio, a.concepto].filter(Boolean).join(' · '),
          `${signo}${dinero(a.monto)}`,
          `${cash > 0 ? '+' : ''}${dinero(cash)}`,
        ], colsEventos, { cancelada: a.clase === 'CANCELACION' });
      });
      nota('Los reversos de ventas canceladas aparecen únicamente para auditoría: ya están excluidos del resumen y no deben sumarse nuevamente.');
    }

    // El contrato original también acepta "movimientos"; se conserva para
    // compatibilidad, mientras "actividad" representa la cronología unificada.
    void movimientos;

    if (sesion.observaciones) {
      seccion('05', 'Observaciones del cierre', '', 80);
      const h = doc.font('Helvetica').fontSize(9).heightOfString(String(sesion.observaciones), {
        width: W - 25,
      });
      espacio(h + 22);
      caja(M, y, W, h + 18, P.suave, 7);
      texto(sesion.observaciones, M + 13, y + 9, W - 26, {
        tamano: 9, color: P.tinta,
      });
      y += h + 25;
    }

    const paginas = doc.bufferedPageRange();
    for (let indice = paginas.start; indice < paginas.start + paginas.count; indice++) {
      doc.switchToPage(indice);
      raya(M, 794, M + W, P.linea, 0.8);
      doc.rect(M, 793, 46, 2).fill(P.rosa);
      texto('LUDAROPE  /  DOCUMENTO DIGITAL INTERNO  /  IMPORTES EN MXN', M, 806, W - 82, {
        fuente: 'Helvetica-Bold', tamano: 7, color: P.secundaria,
      });
      texto(`${indice - paginas.start + 1} / ${paginas.count}`, M + W - 69, 805, 69, {
        fuente: 'Helvetica-Bold', tamano: 8, color: P.secundaria,
        alineacion: 'right',
      });
    }
    doc.end();
  });
}

module.exports = { generarCorteCajaPdf };
