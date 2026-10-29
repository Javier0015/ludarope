// Datos del catálogo público V1. No incluir campos de costo ni endpoints internos.
export const MARCA = Object.freeze({
  rosa: '#FC4D84',
  coral: '#FE714B',
  naranja: '#FF751F',
  dorado: '#E7AA44',
  blanco: '#FEFEFE',
  tinta: '#302730',
});

export const moneda = (valor) => Number(valor || 0).toLocaleString('es-MX', {
  style: 'currency', currency: 'MXN',
});

export const normalizar = (texto) => String(texto || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Las fotografías originales viven en /uploads del backend; no duplicamos nada.
export const obtenerFoto = (ruta) => {
  if (typeof ruta !== 'string' || !ruta.trim()) return null;
  const base = import.meta.env.VITE_API_URL || '/api';
  const servidor = /^https?:\/\//i.test(base) ? new URL(base).origin : window.location.origin;
  if (ruta.startsWith('/uploads/')) return `${servidor}${ruta}`;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return null;
};

export const fotosValidas = (prenda) => (Array.isArray(prenda?.fotos) ? prenda.fotos : [])
  .map(obtenerFoto).filter(Boolean).slice(0, 4);

export const sucursalesDisponibles = (prenda) =>
  (Array.isArray(prenda?.disponibilidad) ? prenda.disponibilidad : [])
    .filter((s) => Number(s.cantidad) > 0 && s.sucursal);

export const unidadesDisponibles = (prenda) => sucursalesDisponibles(prenda)
  .reduce((total, sucursal) => total + Number(sucursal.cantidad || 0), 0);
