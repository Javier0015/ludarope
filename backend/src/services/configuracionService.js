'use strict';
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const pool = require('../config/db');

const DEFAULT_TICKET = Object.freeze({
  nombre_negocio: 'LUDAROPE', subtitulo: 'Luce chingona.', rfc: '', direccion: '', telefono: '',
  mensaje_gracias: '¡GRACIAS POR SU COMPRA!', mensaje_pie: 'CONSERVE SU TICKET PARA CUALQUIER DUDA O ACLARACIÓN',
  mensaje_ecologico: 'Gracias por elegir un comprobante digital. Menos papel, más estilo.',
  color_primario: '#FC4D84', color_secundario: '#E7AA44', color_texto: '#302730',
  mostrar_rfc: true, mostrar_direccion: true, mostrar_telefono: true,
  mostrar_descuento: true, mostrar_impuesto: false, mostrar_ahorro: true,
  mostrar_ecologico: true, formato: 'detallado',
});
const DEFAULT_GENERAL = Object.freeze({ slogan: 'Luce chingona.', moneda: 'MXN', zona_horaria: 'America/Mexico_City' });
const DEFAULT_SMTP = Object.freeze({ activo: false, host: '', puerto: 587, secure: false,
  usuario: '', remitente: '', nombre_remitente: 'LUDAROPE',
  asunto_ticket: 'Tu comprobante de compra · LUDAROPE · {folio}',
  cuerpo_ticket: '¡Gracias por tu compra en LUDAROPE!\nAquí encontrarás los detalles de tu compra.\nLuce chingona.',
  incluir_ticket_html: true, adjuntar_pdf: true, usar_diseno_ticket: true,
});
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const hexColor = (v) => /^#[\da-fA-F]{6}$/.test(String(v || ''));
const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
const campoTextoTicket = {
  nombre_negocio: 80, subtitulo: 100, rfc: 25, direccion: 300, telefono: 50,
  mensaje_gracias: 130, mensaje_pie: 260, mensaje_ecologico: 240,
};
const flagsTicket = [
  'mostrar_rfc', 'mostrar_direccion', 'mostrar_telefono', 'mostrar_descuento',
  'mostrar_impuesto', 'mostrar_ahorro', 'mostrar_ecologico',
];

function validarTicket(body) {
  const t = { ...DEFAULT_TICKET };
  for (const [k, max] of Object.entries(campoTextoTicket)) t[k] = txt(body?.[k] ?? t[k], max);
  if (!t.nombre_negocio) throw new Error('Es obligatorio indicar el nombre comercial del ticket.');
  for (const k of ['color_primario', 'color_secundario', 'color_texto']) {
    const valor = body?.[k] ?? t[k];
    if (!hexColor(valor)) throw new Error(`Color inválido: ${k}`);
    t[k] = valor.toUpperCase();
  }
  for (const k of flagsTicket) t[k] = body?.[k] === undefined ? t[k] : body[k] === true;
  t.formato = body?.formato === 'compacto' ? 'compacto' : 'detallado';
  return t;
}
function validarGeneral(body) {
  return { ...DEFAULT_GENERAL, slogan: txt(body?.slogan ?? DEFAULT_GENERAL.slogan, 130) };
}
function validarCorreo(body) {
  const conf = {
    activo: body?.activo === true, host: txt(body?.host, 200),
    puerto: Number(body?.puerto || 587), secure: body?.secure === true,
    usuario: txt(body?.usuario, 180), remitente: txt(body?.remitente, 254),
    nombre_remitente: txt(body?.nombre_remitente || 'LUDAROPE', 100),
    asunto_ticket: txt(body?.asunto_ticket ?? DEFAULT_SMTP.asunto_ticket, 200),
    cuerpo_ticket: txt(body?.cuerpo_ticket ?? DEFAULT_SMTP.cuerpo_ticket, 2000),
    incluir_ticket_html: body?.incluir_ticket_html !== false,
    adjuntar_pdf: body?.adjuntar_pdf !== false,
    usar_diseno_ticket: body?.usar_diseno_ticket !== false,
  };
  if (!Number.isInteger(conf.puerto) || conf.puerto < 1 || conf.puerto > 65535) throw new Error('Puerto SMTP inválido');
  if (conf.host && (!/^[a-z\d.-]+$/i.test(conf.host) || conf.host.includes('..'))) throw new Error('Host SMTP inválido');
  if (conf.remitente && !emailValido(conf.remitente)) throw new Error('Correo remitente inválido');
  if (!conf.incluir_ticket_html && !conf.adjuntar_pdf) throw new Error('Activa el ticket en el correo o el adjunto PDF.');
  if (conf.activo && (!conf.host || !conf.usuario || !conf.remitente)) throw new Error('Completa servidor, usuario y remitente SMTP');
  return conf;
}

function keyCifrado() {
  const valor = process.env.CONFIG_ENCRYPTION_KEY || '';
  if (!/^[\da-fA-F]{64}$/.test(valor)) {
    const e = new Error('Para guardar la contraseña SMTP configura CONFIG_ENCRYPTION_KEY con 64 caracteres hexadecimales en backend/.env');
    e.code = 'CONFIG_KEY_MISSING'; throw e;
  }
  return Buffer.from(valor, 'hex');
}
function cifrarSecreto(secreto) {
  const key = keyCifrado();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secreto, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
function descifrarSecreto(token) {
  const [iv, tag, content] = String(token).split('.');
  if (!iv || !tag || !content) throw new Error('Contraseña cifrada con formato inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyCifrado(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(content, 'base64')), decipher.final()]).toString('utf8');
}
async function cargarConfiguracion() {
  const r = await pool.query('SELECT ticket, general, smtp, smtp_password_enc, logo_png FROM public.ludarope_configuracion WHERE id=1');
  const row = r.rows[0] || {};
  return {
    ticket: { ...DEFAULT_TICKET, ...(row.ticket || {}) },
    general: { ...DEFAULT_GENERAL, ...(row.general || {}) },
    correo: { ...DEFAULT_SMTP, ...(row.smtp || {}), tiene_password: Boolean(row.smtp_password_enc) },
    smtp_password_enc: row.smtp_password_enc || null,
    logo_png: row.logo_png || null,
  };
}
function remitente(nombre, correo) {
  const limpio = String(nombre || '').replace(/[\r\n"\\]/g, '').slice(0, 100);
  return `"${limpio}" <${correo}>`;
}
async function transporteCorreo() {
  const c = await cargarConfiguracion();
  if (c.correo.activo) {
    if (!c.smtp_password_enc) { const err = new Error('Contraseña SMTP no configurada'); err.code='SMTP_UNCONFIGURED'; throw err; }
    const conf = c.correo;
    const password = descifrarSecreto(c.smtp_password_enc);
    return {
      transport: nodemailer.createTransport({ host: conf.host, port: conf.puerto, secure: conf.secure,
        requireTLS: !conf.secure, auth: { user: conf.usuario, pass: password },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 }),
      from: remitente(conf.nombre_remitente, conf.remitente),
      correo: conf,
    };
  }
  // Compatibilidad con el SMTP del POS anterior cuando no se activa el guardado por DB.
  const host = process.env.SMTP_HOST, usuario = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD, from = process.env.SMTP_FROM;
  if (!host || !usuario || !pass || !from) {
    const err = new Error('SMTP no está configurado. Activa y guarda correo en Configuración o usa variables SMTP_* en .env.');
    err.code='SMTP_UNCONFIGURED'; throw err;
  }
  const puerto = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || puerto === 465;
  return { transport: nodemailer.createTransport({ host, port: puerto, secure, requireTLS: !secure,
    auth: { user: usuario, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 }),
    from, correo: { ...DEFAULT_SMTP, ...c.correo } };
}
module.exports = {
  DEFAULT_TICKET, DEFAULT_GENERAL, DEFAULT_SMTP, validarTicket, validarGeneral,
  validarCorreo, cargarConfiguracion, cifrarSecreto, transporteCorreo, emailValido,
};
