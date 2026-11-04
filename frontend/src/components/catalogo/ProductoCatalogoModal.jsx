import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, MapPin, Package, Shirt, X } from 'lucide-react';
import CarruselPrenda from './CarruselPrenda';
import { fotosValidas, moneda, etiquetaOferta, sucursalesDisponibles, unidadesDisponibles } from './catalogoUtils';

export default function ProductoCatalogoModal({ prenda, onCerrar }) {
  const cerrarRef = useRef(null);
  useEffect(() => {
    if (!prenda) return undefined;
    const anterior = document.activeElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = original; anterior?.focus?.(); };
  }, [prenda?.id_prenda, onCerrar]);

  if (!prenda) return null;
  const tiendas = sucursalesDisponibles(prenda);
  const fotos = fotosValidas(prenda);
  const ofertas = prenda.ofertas || [];
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#20161E]/75 p-2 backdrop-blur-[4px] sm:p-5"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="detalle-prenda-titulo"
        className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] bg-[#FEFEFE] shadow-2xl sm:rounded-[2rem]">
        <button ref={cerrarRef} type="button" aria-label="Cerrar detalles" onClick={onCerrar}
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white text-[#302730] shadow-lg hover:text-[#FC4D84]">
          <X size={21}/>
        </button>
        <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[.95fr_1.05fr]">
          <div className="relative bg-[#FFF0F5] p-3 sm:p-5">
            <CarruselPrenda key={prenda.id_prenda} formato="modal" imagenes={fotos} nombre={prenda.nombre}
              intervalo={5400} className="rounded-[1.2rem] sm:rounded-[1.5rem]" />
            {fotos.length > 1 && <p className="mt-2 text-center text-xs font-medium text-[#927983]"></p>}
          </div>
          <div className="min-w-0 p-5 sm:p-8 lg:py-11">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF0F5] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#DE366F]">
              <Shirt size={13}/>{prenda.categoria}
            </div>
            <h2 id="detalle-prenda-titulo" className="mt-4 break-words font-serif text-3xl font-semibold leading-tight text-[#302730] sm:text-4xl">{prenda.nombre}</h2>
            {ofertas.length>0 && <div className="mt-3 flex flex-wrap gap-2">{ofertas.map(o=><span key={o.id_promocion} className="rounded-full bg-[#FC4D84] px-3 py-1 text-xs font-black text-white">{etiquetaOferta(o.etiqueta)} · {o.nombre}</span>)}</div>}
            {prenda.precio_promocional!==null && prenda.precio_promocional!==undefined && <p className="mt-2 text-sm text-[#A18C97] line-through">{moneda(prenda.precio_venta)}</p>}
            <p className="mt-4 text-3xl font-black text-[#FC4D84]">{moneda(prenda.precio_promocional ?? prenda.precio_venta)}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#F4D7E2] bg-[#FFF9FB] px-3 py-1.5 text-xs font-semibold text-[#584750]">Talla: {prenda.talla}</span>
              <span className="rounded-full border border-[#F4D7E2] bg-[#FFF9FB] px-3 py-1.5 text-xs font-semibold text-[#584750]">Color: {prenda.color}</span>
              <span className="rounded-full border border-[#FFE0C6] bg-[#FFF5EB] px-3 py-1.5 text-xs font-semibold text-[#9C5227]">{unidadesDisponibles(prenda)} unidad(es) disponible(s)</span>
            </div>
            {prenda.descripcion && <div className="mt-6"><h3 className="text-xs font-black uppercase tracking-wider text-[#8A727D]">Descripción</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#61535A]">{prenda.descripcion}</p></div>}
            <div className="mt-7 border-t border-[#F0E0E5] pt-6">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#302730]"><MapPin size={17} className="text-[#FE714B]"/>Disponibilidad por sucursal</h3>
              <div className="mt-3 space-y-2">
                {tiendas.map((s, i) => <div key={`${s.sucursal}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#F4E2E8] bg-[#FFF9FA] px-4 py-3">
                  <span className="min-w-0 break-words text-sm font-semibold text-[#4E3D46]">{s.sucursal}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#C84271]"><Check size={15}/>{s.cantidad} disponible(s)</span>
                </div>)}
                {!tiendas.length && <p className="text-sm text-[#88717D]">Esta prenda ya no está disponible.</p>}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#97808A]">Las existencias pueden cambiar. Confirma la disponibilidad directamente en la sucursal antes de visitarla.</p>
            </div>
            <button type="button" onClick={onCerrar} className="mt-7 inline-flex items-center gap-2 rounded-xl border border-[#F3C5D4] px-5 py-3 text-sm font-extrabold text-[#D8346C] transition hover:bg-[#FFF0F5]"><Package size={16}/>Seguir explorando</button>
          </div>
        </div>
      </section>
    </div>, document.body,
  );
}
