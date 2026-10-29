const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const pool = require('../config/db');
const { verificarToken, autorizarRoles } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(verificarToken);

const TABLAS = {
  categorias: { tabla: 'categorias', pk: 'id_categoria', longitud: 80 },
  tallas: { tabla: 'tallas', pk: 'id_talla', longitud: 40 },
  colores: { tabla: 'colores', pk: 'id_color', longitud: 60 },
};
const CARPETA_FOTOS = path.resolve(__dirname, '../../uploads/prendas');
const tiposImagen = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 4, fileSize: 6 * 1024 * 1024, fields: 20 },
  fileFilter: (_req, file, cb) => tiposImagen.has(file.mimetype) ? cb(null, true) : cb(new Error('Formato de imagen no permitido')),
});
const entero = (v) => /^\d+$/.test(String(v ?? '')) && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const cantidadValida = (v) => {
  const n = entero(v);
  return n && n <= 10000 ? n : null;
};
const importe = (v, permiteCero = false) => {
  const texto = String(v ?? '').trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(texto)) return null;
  const n = Number(texto);
  return Number.isFinite(n) && (permiteCero ? n >= 0 : n > 0) ? n.toFixed(2) : null;
};
const validoBooleano = (v) => ['true', 'false', true, false].includes(v);
// Código opcional: no convertir a número para preservar ceros iniciales.
const normalizarCodigoBarras = (valor) => String(valor ?? '').trim().toUpperCase() || null;
const codigoBarrasValido = (valor) => valor === null || /^[A-Z0-9._-]{3,80}$/.test(valor);

function resolverSucursal(req, id) {
  const solicitada = entero(id);
  if (req.usuario.rol === 'CAJERO') {
    if (!solicitada || solicitada !== Number(req.usuario.id_sucursal)) return null;
  }
  return solicitada;
}

router.get('/sucursales', async (req, res) => {
  try {
    const esCajero = req.usuario.rol === 'CAJERO';
    const { rows } = await pool.query(
      `SELECT id_sucursal, nombre FROM sucursales WHERE activa = TRUE
       AND ($1::integer IS NULL OR id_sucursal = $1)
       ORDER BY nombre`, [esCajero ? req.usuario.id_sucursal : null]
    );
    res.json({ ok: true, sucursales: rows });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, mensaje: 'Error al cargar sucursales' }); }
});

router.get('/catalogos/:tipo', async (req, res) => {
  const conf = TABLAS[req.params.tipo];
  if (!conf) return res.status(404).json({ ok: false, mensaje: 'Catálogo desconocido' });
  try {
    const { rows } = await pool.query(
      `SELECT ${conf.pk} AS id, nombre FROM ${conf.tabla} WHERE activo = TRUE ORDER BY nombre`
    );
    res.json({ ok: true, opciones: rows });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, mensaje: 'Error al consultar opciones' }); }
});

router.post('/catalogos/:tipo', async (req, res) => {
  const conf = TABLAS[req.params.tipo];
  if (!conf) return res.status(404).json({ ok: false, mensaje: 'Catálogo desconocido' });
  const nombre = String(req.body?.nombre ?? '').trim().replace(/\s+/g, ' ');
  if (!nombre || nombre.length > conf.longitud) return res.status(400).json({ ok: false, mensaje: 'Nombre inválido' });
  try {
    const agregado = await pool.query(
      `INSERT INTO ${conf.tabla}(nombre) VALUES ($1) ON CONFLICT DO NOTHING RETURNING ${conf.pk} AS id, nombre`, [nombre]
    );
    if (agregado.rowCount) return res.status(201).json({ ok: true, opcion: agregado.rows[0] });
    const existente = await pool.query(
      `SELECT ${conf.pk} AS id, nombre, activo FROM ${conf.tabla} WHERE lower(btrim(nombre)) = lower($1)`, [nombre]
    );
    const item = existente.rows[0];
    if (!item) return res.status(409).json({ ok: false, mensaje: 'Intenta de nuevo' });
    if (!item.activo && req.usuario.rol !== 'ADMIN') {
      return res.status(409).json({ ok: false, mensaje: 'Opción desactivada. Solicita al administrador reactivarla.' });
    }
    if (!item.activo) {
      await pool.query(`UPDATE ${conf.tabla} SET activo = TRUE WHERE ${conf.pk} = $1`, [item.id]);
    }
    return res.json({ ok: true, opcion: { id: item.id, nombre: item.nombre } });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, mensaje: 'No se pudo guardar la opción' }); }
});

router.delete('/catalogos/:tipo/:id', autorizarRoles('ADMIN'), async (req, res) => {
  const conf = TABLAS[req.params.tipo];
  const id = entero(req.params.id);
  if (!conf || !id) return res.status(400).json({ ok: false, mensaje: 'Opción inválida' });
  try {
    const r = await pool.query(`UPDATE ${conf.tabla} SET activo = FALSE WHERE ${conf.pk} = $1 RETURNING ${conf.pk}`, [id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, mensaje: 'No encontrada' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, mensaje: 'No se pudo desactivar' }); }
});

router.get('/prendas', async (req, res) => {
  try {
    let sucursal = req.query.id_sucursal ? entero(req.query.id_sucursal) : null;
    if (req.query.id_sucursal && !sucursal) return res.status(400).json({ ok: false, mensaje: 'Sucursal inválida' });
    if (req.usuario.rol === 'CAJERO') sucursal = Number(req.usuario.id_sucursal);
    const { rows } = await pool.query(`
      SELECT p.id_prenda, p.nombre, p.descripcion, p.precio_venta, p.codigo_barras, p.publicar_catalogo,
             p.fecha_creacion, c.nombre AS categoria, t.nombre AS talla, co.nombre AS color,
             COALESCE(SUM(i.cantidad),0)::integer AS cantidad,
             COALESCE((SELECT json_agg(f.ruta ORDER BY f.orden)
                       FROM prendas_fotos f WHERE f.id_prenda = p.id_prenda),'[]'::json) AS fotos
      FROM prendas p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      JOIN tallas t ON t.id_talla = p.id_talla
      JOIN colores co ON co.id_color = p.id_color
      LEFT JOIN inventario_sucursales i ON i.id_prenda = p.id_prenda
        AND ($1::integer IS NULL OR i.id_sucursal = $1)
      WHERE p.activa = TRUE
        AND ($1::integer IS NULL OR EXISTS (
          SELECT 1 FROM inventario_sucursales ex WHERE ex.id_prenda = p.id_prenda AND ex.id_sucursal = $1))
      GROUP BY p.id_prenda, c.nombre, t.nombre, co.nombre
      ORDER BY p.id_prenda DESC LIMIT 500
    `, [sucursal]);
    res.json({ ok: true, prendas: rows }); // Nunca devolver costos aquí.
  } catch (e) { console.error(e); res.status(500).json({ ok: false, mensaje: 'Error al consultar prendas' }); }
});

// Endpoint administrativo exclusivo. Costos no accesibles a cajeros.
router.get('/costos', autorizarRoles('ADMIN'), async (req, res) => {
  try {
    const idSucursal = req.query.id_sucursal ? entero(req.query.id_sucursal) : null;
    if (req.query.id_sucursal && !idSucursal) return res.status(400).json({ ok: false, mensaje: 'Sucursal inválida' });
    const { rows } = await pool.query(`
      SELECT p.id_prenda, p.nombre, p.precio_venta, c.nombre AS categoria,
             t.nombre AS talla, co.nombre AS color,
             pc.costo_unitario, pc.fecha_actualizacion AS fecha_costo,
             COALESCE(SUM(i.cantidad),0)::integer AS stock_actual
      FROM prendas p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      JOIN tallas t ON t.id_talla = p.id_talla
      JOIN colores co ON co.id_color = p.id_color
      LEFT JOIN prendas_costos pc ON pc.id_prenda = p.id_prenda
      LEFT JOIN inventario_sucursales i ON i.id_prenda = p.id_prenda
        AND ($1::integer IS NULL OR i.id_sucursal = $1)
      WHERE p.activa = TRUE
        AND ($1::integer IS NULL OR EXISTS (
          SELECT 1 FROM inventario_sucursales ex WHERE ex.id_prenda = p.id_prenda AND ex.id_sucursal = $1))
      GROUP BY p.id_prenda, c.nombre, t.nombre, co.nombre, pc.costo_unitario, pc.fecha_actualizacion
      ORDER BY (pc.costo_unitario IS NOT NULL), p.id_prenda DESC LIMIT 500
    `,[idSucursal]);
    res.json({ ok: true, prendas: rows });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, mensaje: 'Error al consultar costos' }); }
});

router.put('/costos/:id', autorizarRoles('ADMIN'), async (req, res) => {
  const id = entero(req.params.id);
  const costo = importe(req.body?.costo_unitario, true);
  if (!id || costo === null) return res.status(400).json({ ok: false, mensaje: 'Costo inválido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existe = await client.query('SELECT id_prenda FROM prendas WHERE id_prenda = $1 AND activa = TRUE FOR UPDATE', [id]);
    if (!existe.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, mensaje: 'Prenda no encontrada' }); }
    const anterior = await client.query('SELECT costo_unitario FROM prendas_costos WHERE id_prenda = $1', [id]);
    await client.query(`
      INSERT INTO prendas_costos(id_prenda, costo_unitario, actualizado_por)
      VALUES ($1,$2,$3)
      ON CONFLICT (id_prenda) DO UPDATE SET costo_unitario = EXCLUDED.costo_unitario,
      actualizado_por = EXCLUDED.actualizado_por, fecha_actualizacion = now()
    `, [id,costo,req.usuario.id_usuario]);
    await client.query(`
      INSERT INTO prendas_costos_historial(id_prenda, costo_anterior, costo_nuevo, id_usuario)
      VALUES ($1,$2,$3,$4)
    `, [id, anterior.rows[0]?.costo_unitario ?? null, costo, req.usuario.id_usuario]);
    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Costo guardado' });
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ ok: false, mensaje: 'No se pudo guardar el costo' }); }
  finally { client.release(); }
});

router.post('/prendas', (req,res,next) => {
  upload.array('fotos',4)(req,res,err=>{
    if (err) return res.status(400).json({ ok:false, mensaje: err.code === 'LIMIT_FILE_SIZE' ? 'Cada fotografía debe pesar máximo 6 MB' : 'Máximo cuatro fotografías o archivo inválido' });
    next();
  });
}, async (req, res) => {
  const { nombre, descripcion, id_categoria, id_talla, id_color, precio_venta,
    id_sucursal, cantidad, publicar_catalogo, codigo_barras } = req.body;
  const codigoBarras = normalizarCodigoBarras(codigo_barras);
  if (!codigoBarrasValido(codigoBarras)) return res.status(400).json({ok:false,mensaje:'Código de barras inválido (3 a 80 caracteres alfanuméricos, . _ -).'});
  const ids = [id_categoria,id_talla,id_color].map(entero);
  const sucursal = resolverSucursal(req,id_sucursal);
  const cant = cantidadValida(cantidad);
  const precio = importe(precio_venta);
  if (!String(nombre||'').trim() || String(nombre).trim().length>180 || !ids.every(Boolean) ||
      !sucursal || !cant || precio === null || !validoBooleano(publicar_catalogo) ||
      String(descripcion||'').length>1500) {
    return res.status(400).json({ok:false,mensaje:'Verifica los datos de la prenda y sucursal'});
  }
  const client = await pool.connect();
  const creados = [];
  try {
    await client.query('BEGIN');
    const activa = await client.query('SELECT id_sucursal FROM sucursales WHERE id_sucursal=$1 AND activa=TRUE',[sucursal]);
    if (!activa.rowCount) {
      await client.query('ROLLBACK'); return res.status(400).json({ok:false,mensaje:'Sucursal no disponible'});
    }
    for(const [tabla, pk, id] of [ ['categorias','id_categoria',ids[0]], ['tallas','id_talla',ids[1]], ['colores','id_color',ids[2]] ]) {
      const valida = await client.query(`SELECT 1 FROM ${tabla} WHERE ${pk}=$1 AND activo=TRUE`,[id]);
      if(!valida.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ok:false,mensaje:'Selecciona una categoría, talla y color activos'}); }
    }
    const ins = await client.query(`
      INSERT INTO prendas(nombre,descripcion,id_categoria,id_talla,id_color,precio_venta,publicar_catalogo,creada_por,codigo_barras)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_prenda
    `,[String(nombre).trim(),String(descripcion||'').trim()||null, ...ids, precio,
       String(publicar_catalogo)==='true', req.usuario.id_usuario, codigoBarras]);
    const idPrenda = ins.rows[0].id_prenda;
    await client.query('INSERT INTO inventario_sucursales(id_prenda,id_sucursal,cantidad) VALUES($1,$2,$3)',[idPrenda,sucursal,cant]);
    await client.query(`INSERT INTO inventario_movimientos(id_prenda,id_sucursal,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo)
      VALUES($1,$2,$3,'ALTA',$4,0,$4)`,[idPrenda,sucursal,req.usuario.id_usuario,cant]);
    await fs.mkdir(CARPETA_FOTOS,{recursive:true});
    for (const [indice,file] of (req.files||[]).entries()) {
      if (!tiposImagen.has(file.mimetype)) throw new Error('Formato de imagen no permitido');
      const filename = `${crypto.randomUUID()}.webp`;
      const destino = path.join(CARPETA_FOTOS,filename);
      const imagen = await sharp(file.buffer,{limitInputPixels:40000000})
        .rotate().resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true})
        .webp({quality:82}).toBuffer();
      await fs.writeFile(destino,imagen,{flag:'wx'});
      creados.push(destino);
      await client.query('INSERT INTO prendas_fotos(id_prenda,ruta,orden) VALUES($1,$2,$3)',
        [idPrenda, `/uploads/prendas/${filename}`, indice+1]);
    }
    await client.query('COMMIT');
    res.status(201).json({ok:true,mensaje:'Prenda registrada', id_prenda:idPrenda,
      codigo:`LDR-${String(idPrenda).padStart(6,'0')}`});
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    await Promise.all(creados.map(f=>fs.unlink(f).catch(()=>{})));
    console.error('Alta prenda:',e);
    if (e.code === '23505' && e.constraint === 'ux_prendas_codigo_barras') return res.status(409).json({ok:false,mensaje:'El código de barras ya está asignado a otra prenda.'});
    res.status(500).json({ok:false,mensaje: 'No se pudo registrar la prenda o procesar sus imágenes'});
  } finally { client.release(); }
});

// Información editable de una prenda. No expone costos ni existencias privadas.
router.get('/prendas/:id/editar', autorizarRoles('ADMIN'), async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(400).json({ ok: false, mensaje: 'Prenda inválida' });
  try {
    const consulta = await pool.query(`
      SELECT id_prenda, nombre, descripcion, id_categoria, id_talla, id_color,
             precio_venta, codigo_barras, publicar_catalogo
      FROM prendas WHERE id_prenda = $1 AND activa = TRUE`, [id]);
    if (!consulta.rowCount) return res.status(404).json({ ok: false, mensaje: 'Prenda no encontrada' });
    const fotos = await pool.query(`
      SELECT id_foto, ruta, orden FROM prendas_fotos
      WHERE id_prenda = $1 ORDER BY orden, id_foto`, [id]);
    res.json({ ok: true, prenda: { ...consulta.rows[0], fotos: fotos.rows } });
  } catch (e) {
    console.error('Consultar prenda para edición:', e);
    res.status(500).json({ ok: false, mensaje: 'No se pudo cargar la prenda' });
  }
});

// Edita datos y galería sin alterar stock, costos, código LDR ni historial de ventas.
// Fotos conservadas = array JSON de id_foto; hasta 4 fotos entre conservadas y nuevas.
router.put('/prendas/:id', autorizarRoles('ADMIN'), (req, res, next) => {
  upload.array('fotos', 4)(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false,
      mensaje: err.code === 'LIMIT_FILE_SIZE'
        ? 'Cada fotografía debe pesar máximo 6 MB'
        : 'Máximo cuatro fotografías nuevas, JPG/PNG/WebP' });
    next();
  });
}, async (req, res) => {
  const id = entero(req.params.id);
  const { nombre, descripcion, id_categoria, id_talla, id_color,
    precio_venta, codigo_barras, publicar_catalogo } = req.body;
  const ids = [id_categoria, id_talla, id_color].map(entero);
  const precio = importe(precio_venta);
  const codigo = normalizarCodigoBarras(codigo_barras);
  let conservar;
  try { conservar = JSON.parse(req.body.fotos_conservar); }
  catch { return res.status(400).json({ ok: false, mensaje: 'Listado de fotos inválido' }); }
  if (!id || !String(nombre || '').trim() || String(nombre).trim().length > 180 ||
      String(descripcion || '').length > 1500 || !ids.every(Boolean) ||
      precio === null || !codigoBarrasValido(codigo) || !validoBooleano(publicar_catalogo) ||
      !Array.isArray(conservar) || conservar.some((x) => !entero(x)) ||
      new Set(conservar.map(Number)).size !== conservar.length ||
      conservar.length + (req.files || []).length > 4) {
    return res.status(400).json({ ok: false, mensaje: 'Datos o fotografías inválidos. Máximo cuatro imágenes.' });
  }

  const client = await pool.connect();
  const archivosNuevos = [];
  let confirmado = false;
  try {
    await client.query('BEGIN');
    // Bloquear la prenda: dos administradores no pueden modificar su galería a la vez.
    const prenda = await client.query(
      'SELECT id_prenda, id_categoria, id_talla, id_color FROM prendas WHERE id_prenda=$1 AND activa=TRUE FOR UPDATE', [id]);
    if (!prenda.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, mensaje: 'Prenda no encontrada' });
    }
    for (const [tabla, pk, idOpcion, anterior] of [
      ['categorias', 'id_categoria', ids[0], prenda.rows[0].id_categoria],
      ['tallas', 'id_talla', ids[1], prenda.rows[0].id_talla],
      ['colores', 'id_color', ids[2], prenda.rows[0].id_color],
    ]) {
      // Permite conservar una opción anterior inactiva, pero no seleccionar una nueva inactiva.
      const r = await client.query(
        `SELECT 1 FROM ${tabla} WHERE ${pk}=$1 AND (activo=TRUE OR ${pk}=$2)`,
        [idOpcion, anterior]);
      if (!r.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, mensaje: 'Categoría, talla o color no disponible' });
      }
    }
    const anteriores = await client.query(
      'SELECT id_foto, ruta, orden FROM prendas_fotos WHERE id_prenda=$1 ORDER BY orden, id_foto FOR UPDATE', [id]);
    const mapa = new Map(anteriores.rows.map((f) => [Number(f.id_foto), f]));
    if (conservar.some((fotoId) => !mapa.has(Number(fotoId)))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, mensaje: 'Las fotografías cambiaron. Abre nuevamente la edición.' });
    }
    // Se preserva el orden anterior de las fotos guardadas; nuevas fotos van al final.
    const conservarSet = new Set(conservar.map(Number));
    const fotoRestantes = anteriores.rows.filter((f) => conservarSet.has(Number(f.id_foto)));
    const fotosQuitar = anteriores.rows.filter((f) => !conservarSet.has(Number(f.id_foto)));

    await client.query(`
      UPDATE prendas SET nombre=$2, descripcion=$3, id_categoria=$4, id_talla=$5,
        id_color=$6, precio_venta=$7, codigo_barras=$8, publicar_catalogo=$9,
        fecha_actualizacion=now()
      WHERE id_prenda=$1`,
      [id, String(nombre).trim(), String(descripcion || '').trim() || null,
        ...ids, precio, codigo, String(publicar_catalogo) === 'true']);

    // Eliminar referencias solo dentro de la transacción. Archivos físicos se borran tras COMMIT.
    if (fotosQuitar.length) {
      await client.query('DELETE FROM prendas_fotos WHERE id_prenda=$1 AND id_foto = ANY($2::integer[])',
        [id, fotosQuitar.map((f) => f.id_foto)]);
    }
    // UNIQUE (id_prenda,orden): compactar ascendentemente evita colisiones.
    for (const [indice, foto] of fotoRestantes.entries()) {
      if (Number(foto.orden) !== indice + 1) {
        await client.query('UPDATE prendas_fotos SET orden=$3 WHERE id_prenda=$1 AND id_foto=$2',
          [id, foto.id_foto, indice + 1]);
      }
    }

    if ((req.files || []).length) await fs.mkdir(CARPETA_FOTOS, { recursive: true });
    for (const [indice, file] of (req.files || []).entries()) {
      const nuevoNombre = `${crypto.randomUUID()}.webp`;
      const rutaFisica = path.join(CARPETA_FOTOS, nuevoNombre);
      const imagen = await sharp(file.buffer, { limitInputPixels: 40000000 })
        .rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer();
      await fs.writeFile(rutaFisica, imagen, { flag: 'wx' });
      archivosNuevos.push(rutaFisica);
      await client.query('INSERT INTO prendas_fotos(id_prenda,ruta,orden) VALUES($1,$2,$3)',
        [id, `/uploads/prendas/${nuevoNombre}`, fotoRestantes.length + indice + 1]);
    }

    await client.query('COMMIT');
    confirmado = true;
    // Solo después de confirmar los cambios puede borrarse una fotografía antigua.
    await Promise.all(fotosQuitar.map(async ({ ruta }) => {
      const prefijo = '/uploads/prendas/';
      if (typeof ruta !== 'string' || !ruta.startsWith(prefijo)) return;
      const archivo = ruta.slice(prefijo.length);
      if (path.basename(archivo) !== archivo || !/^[-a-zA-Z0-9_]+\.webp$/.test(archivo)) return;
      await fs.unlink(path.join(CARPETA_FOTOS, archivo)).catch((e) => {
        if (e.code !== 'ENOENT') console.warn('No se pudo liberar foto anterior:', e.message);
      });
    }));
    return res.json({ ok: true, mensaje: 'Prenda y fotografías actualizadas', id_prenda: id });
  } catch (e) {
    if (!confirmado) {
      await client.query('ROLLBACK').catch(() => {});
      await Promise.all(archivosNuevos.map((ruta) => fs.unlink(ruta).catch(() => {})));
    }
    if (e.code === '23505' && e.constraint === 'ux_prendas_codigo_barras') {
      return res.status(409).json({ ok: false, mensaje: 'El código de barras ya pertenece a otra prenda' });
    }
    console.error('Editar prenda:', e);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo guardar la prenda' });
  } finally { client.release(); }
});

// Edición del código opcional; preserva movimientos, fotos y código interno LDR.
router.patch('/prendas/:id/codigo-barras', autorizarRoles('ADMIN'), async (req, res) => {
  const id = entero(req.params.id);
  if (!id || !Object.prototype.hasOwnProperty.call(req.body || {}, 'codigo_barras')) {
    return res.status(400).json({ok:false,mensaje:'Prenda o código inválido'});
  }
  const codigoBarras = normalizarCodigoBarras(req.body.codigo_barras);
  if (!codigoBarrasValido(codigoBarras)) {
    return res.status(400).json({ok:false,mensaje:'Código inválido: 3 a 80 caracteres alfanuméricos, puntos, guiones o guion bajo.'});
  }
  try {
    const result = await pool.query(`UPDATE prendas SET codigo_barras=$2, fecha_actualizacion=now()
      WHERE id_prenda=$1 AND activa=TRUE RETURNING id_prenda, codigo_barras`, [id, codigoBarras]);
    if (!result.rowCount) return res.status(404).json({ok:false,mensaje:'Prenda no encontrada'});
    return res.json({ok:true, prenda:result.rows[0]});
  } catch (e) {
    if (e.code === '23505' && e.constraint === 'ux_prendas_codigo_barras') {
      return res.status(409).json({ok:false,mensaje:'El código de barras ya está asignado a otra prenda.'});
    }
    console.error('Editar código de barras:', e);
    return res.status(500).json({ok:false,mensaje:'No se pudo actualizar el código de barras'});
  }
});

// Cambia si la prenda se publica, sin tocar el stock.
router.patch('/prendas/:id/publicacion', autorizarRoles('ADMIN'), async(req,res)=>{
  const id=entero(req.params.id);
  if(!id || typeof req.body?.publicar_catalogo!=='boolean') return res.status(400).json({ok:false,mensaje:'Datos inválidos'});
  try {
    const r=await pool.query(`UPDATE prendas SET publicar_catalogo=$2, fecha_actualizacion=now()
      WHERE id_prenda=$1 AND activa=TRUE RETURNING id_prenda`,[id,req.body.publicar_catalogo]);
    if(!r.rowCount) return res.status(404).json({ok:false,mensaje:'Prenda no encontrada'});
    res.json({ok:true});
  } catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'Error al actualizar publicación'});}
});

// Ajustes de existencias auditados. Solo ADMIN; el POS tendrá flujo propio después.
router.post('/prendas/:id/ajustar-stock',autorizarRoles('ADMIN'),async(req,res)=>{
  const id=entero(req.params.id), sucursal=entero(req.body?.id_sucursal);
  const delta=Number(req.body?.diferencia);
  const observaciones=String(req.body?.observaciones||'').trim();
  if(!id||!sucursal||!Number.isInteger(delta)||delta===0||Math.abs(delta)>10000||observaciones.length>500){
    return res.status(400).json({ok:false,mensaje:'Ajuste inválido'});
  }
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const previa=await client.query(`SELECT cantidad FROM inventario_sucursales
      WHERE id_prenda=$1 AND id_sucursal=$2 FOR UPDATE`,[id,sucursal]);
    if(!previa.rowCount){await client.query('ROLLBACK');return res.status(404).json({ok:false,mensaje:'La prenda no está asignada a esta sucursal'});}
    const anterior=previa.rows[0].cantidad, nuevo=anterior+delta;
    if(nuevo<0){await client.query('ROLLBACK');return res.status(409).json({ok:false,mensaje:'Existencias insuficientes'});}
    await client.query(`UPDATE inventario_sucursales SET cantidad=$3, fecha_actualizacion=now()
      WHERE id_prenda=$1 AND id_sucursal=$2`,[id,sucursal,nuevo]);
    await client.query(`INSERT INTO inventario_movimientos(id_prenda,id_sucursal,id_usuario,tipo,cantidad,stock_anterior,stock_nuevo,observaciones)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,sucursal,req.usuario.id_usuario,delta>0?'AJUSTE_ENTRADA':'AJUSTE_SALIDA',Math.abs(delta),anterior,nuevo,observaciones||null]);
    await client.query('COMMIT');res.json({ok:true,cantidad:nuevo});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo ajustar stock'});}
  finally{client.release();}
});
module.exports = router;
