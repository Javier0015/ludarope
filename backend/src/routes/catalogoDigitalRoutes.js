const express = require('express');
const pool = require('../config/db');
const router = express.Router();
// Catálogo público: etiquetas informativas, SIN costos ni configuración privada.
router.get('/prendas', async (_req,res) => {
  try {
    const [articulos,promos] = await Promise.all([
      pool.query(`SELECT p.id_prenda,p.id_categoria,p.nombre,p.descripcion,p.precio_venta,
        c.nombre AS categoria,t.nombre AS talla,co.nombre AS color,
        (SELECT json_agg(f.ruta ORDER BY f.orden) FROM prendas_fotos f WHERE f.id_prenda=p.id_prenda) AS fotos,
        (SELECT json_agg(json_build_object('id_sucursal',s.id_sucursal,'sucursal',s.nombre,'cantidad',i.cantidad) ORDER BY s.nombre)
           FROM inventario_sucursales i JOIN sucursales s ON s.id_sucursal=i.id_sucursal
           WHERE i.id_prenda=p.id_prenda AND i.cantidad>0 AND s.activa=TRUE) AS disponibilidad
        FROM prendas p
        JOIN categorias c ON c.id_categoria=p.id_categoria
        JOIN tallas t ON t.id_talla=p.id_talla
        JOIN colores co ON co.id_color=p.id_color
        WHERE p.activa=TRUE AND p.publicar_catalogo=TRUE
          AND EXISTS(SELECT 1 FROM prendas_fotos f WHERE f.id_prenda=p.id_prenda)
          AND EXISTS(SELECT 1 FROM inventario_sucursales i
            JOIN sucursales s ON s.id_sucursal=i.id_sucursal
            WHERE i.id_prenda=p.id_prenda AND i.cantidad>0 AND s.activa=TRUE)
        ORDER BY p.fecha_creacion DESC LIMIT 200`),
      pool.query(`SELECT p.id_promocion,p.nombre,p.tipo,p.alcance,p.porcentaje,p.precio_especial,p.lleva_n,p.paga_m,p.prioridad,
        ARRAY(SELECT pp.id_prenda FROM promociones_prendas pp WHERE pp.id_promocion=p.id_promocion) AS prendas_ids,
        ARRAY(SELECT pc.id_categoria FROM promociones_categorias pc WHERE pc.id_promocion=p.id_promocion) AS categorias_ids,
        ARRAY(SELECT ps.id_sucursal FROM promociones_sucursales ps WHERE ps.id_promocion=p.id_promocion) AS sucursales_ids
        FROM promociones p WHERE p.activa=TRUE AND p.fecha_inicio<=now() AND p.fecha_fin>now()
        ORDER BY p.prioridad DESC,p.id_promocion ASC`),
    ]);
    const prendas = articulos.rows.map(p => {
      const precio=Number(p.precio_venta);
      const elegibles=promos.rows.filter(pr => {
        if (pr.alcance==='PRENDAS' && !(pr.prendas_ids||[]).map(Number).includes(Number(p.id_prenda))) return false;
        if (pr.alcance==='CATEGORIAS' && !(pr.categorias_ids||[]).map(Number).includes(Number(p.id_categoria))) return false;
        return !(pr.sucursales_ids||[]).length || (p.disponibilidad||[]).some(s=>(pr.sucursales_ids||[]).map(Number).includes(Number(s.id_sucursal)));
      }).map(pr=>{
        const tipo=pr.tipo;
        const precioEspecial=tipo==='PORCENTAJE' ? Math.round(precio*100*(1-Number(pr.porcentaje)/100))/100
          : tipo==='PRECIO_ESPECIAL' ? Number(pr.precio_especial):null;
        const final=precioEspecial!==null && precioEspecial < precio ? precioEspecial : null;
        const etiqueta=tipo==='NXM' ? `${pr.lleva_n}×${pr.paga_m}` : tipo==='PORCENTAJE' ? `${pr.porcentaje}% OFF` : 'Precio especial';
        return {id_promocion:pr.id_promocion,nombre:pr.nombre,tipo,etiqueta,precio_promocional:final,
          sucursales_ids:pr.sucursales_ids||[]};
      }).filter(x=>x.tipo==='NXM'||x.precio_promocional!==null);
      // Sólo estimación informativa: N×M requiere completar grupo, POS valida importe real.
      const directa=elegibles.find(x=>x.tipo!=='NXM'&&x.precio_promocional!==null);
      return {...p,ofertas:elegibles,precio_promocional:directa?.precio_promocional??null};
    });
    res.json({ok:true,prendas});
  } catch(e){console.error('catálogo promociones',e);res.status(500).json({ok:false,mensaje:'No se pudo cargar el catálogo'});}
});
module.exports=router;
