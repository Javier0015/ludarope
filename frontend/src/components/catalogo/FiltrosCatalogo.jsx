import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { normalizar } from './catalogoUtils';

const inputClase = 'w-full min-w-0 rounded-2xl border border-[#EFD8E0] bg-white px-4 py-3 text-sm text-[#493944] outline-none transition focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10';

const COLORES = {
  negro: '#2D232A',
  blanco: '#FEFEFE',
  rosa: '#FC4D84',
  azul: '#567EE8',
  rojo: '#E44A4A',
  verde: '#3CA36A',
  amarillo: '#E7AA44',
  naranja: '#FF751F',
  morado: '#8A5CF6',
  lila: '#B48BFF',
  beige: '#D9C2A0',
  café: '#8B5E3C',
  cafe: '#8B5E3C',
  gris: '#98A2B3',
  dorado: '#E7AA44',
};

function colorChip(valor) {
  const clave = normalizar(valor || '');
  return COLORES[clave] || '#FC4D84';
}

function Chip({ activo, onClick, children, swatch = null, compacto = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border transition ${compacto ? 'px-3 py-2 text-xs' : 'px-3.5 py-2.5 text-xs'} font-extrabold ${activo ? 'border-[#FC4D84] bg-[#FC4D84] text-white shadow-[0_8px_18px_rgba(252,77,132,.22)]' : 'border-[#F0DBE3] bg-white text-[#6F5964] hover:border-[#FC4D84] hover:bg-[#FFF8FB]'}`}
    >
      {swatch ? <span className={`h-3.5 w-3.5 rounded-full border ${activo ? 'border-white/70 ring-1 ring-white/75' : 'border-[#EFD8E0] ring-1 ring-[#F6E9EF]'}`} style={{ background: swatch }} /> : null}
      {children}
    </button>
  );
}

function GrupoInline({ label, children }) {
  return (
    <div className="rounded-[1.35rem] border border-[#F2E1E8] bg-white px-4 py-4 shadow-[0_6px_20px_rgba(66,32,49,.03)]">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[.22em] text-[#9A828D]">{label}</p>
      {children}
    </div>
  );
}

function ChipsWrap({ opciones = [], valor, onCambiar, textoTodos = 'Todas', mostrarColor = false, compacto = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip activo={!valor} onClick={() => onCambiar('')} compacto={compacto}>{textoTodos}</Chip>
      {opciones.map((opcion) => (
        <Chip
          key={opcion}
          activo={valor === opcion}
          onClick={() => onCambiar(opcion)}
          swatch={mostrarColor ? colorChip(opcion) : null}
          compacto={compacto}
        >
          {opcion}
        </Chip>
      ))}
    </div>
  );
}

function ContenidoFiltros({ filtros, onCambiar, opciones, onLimpiar, activos, compacto = false }) {
  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${compacto ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1.1fr_.9fr]'}`}>
        <GrupoInline label="Categorías">
          <ChipsWrap opciones={opciones.categorias} valor={filtros.categoria} onCambiar={(v) => onCambiar('categoria', v)} textoTodos="Todas" compacto={compacto} />
        </GrupoInline>
        <GrupoInline label="Tallas">
          <ChipsWrap opciones={opciones.tallas} valor={filtros.talla} onCambiar={(v) => onCambiar('talla', v)} textoTodos="Todas" compacto={compacto} />
        </GrupoInline>
      </div>

      <div className={`grid gap-4 ${compacto ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-[1fr_1fr]'}`}>
        <GrupoInline label="Colores">
          <ChipsWrap opciones={opciones.colores} valor={filtros.color} onCambiar={(v) => onCambiar('color', v)} mostrarColor textoTodos="Todos" compacto={compacto} />
        </GrupoInline>
        <GrupoInline label="Sucursales">
          <ChipsWrap opciones={opciones.sucursales} valor={filtros.sucursal} onCambiar={(v) => onCambiar('sucursal', v)} textoTodos="Todas" compacto={compacto} />
        </GrupoInline>
      </div>

      <GrupoInline label="Precio y orden">
        <div className={`grid gap-3 ${compacto ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[1fr_1fr_1.1fr_auto]'}`}>
          <input type="number" min="0" step="1" inputMode="decimal" placeholder="Precio mínimo" value={filtros.precioMin} onChange={(e) => onCambiar('precioMin', e.target.value)} className={inputClase} />
          <input type="number" min="0" step="1" inputMode="decimal" placeholder="Precio máximo" value={filtros.precioMax} onChange={(e) => onCambiar('precioMax', e.target.value)} className={inputClase} />
          <select value={filtros.orden} onChange={(e) => onCambiar('orden', e.target.value)} className={inputClase}>
            <option value="recientes">Más recientes</option>
            <option value="precio_asc">Menor precio</option>
            <option value="precio_desc">Mayor precio</option>
            <option value="nombre">Nombre A–Z</option>
          </select>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF5F8] px-4 py-3 md:min-w-[165px]">
            <p className="text-xs text-[#8F7883]">Activos: <span className="font-black text-[#C83E6E]">{activos}</span></p>
            {activos > 0 && (
              <button type="button" onClick={onLimpiar} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#C83E6E] shadow-sm transition hover:bg-[#FFE8F0]">
                <RotateCcw size={14} /> Limpiar
              </button>
            )}
          </div>
        </div>
      </GrupoInline>
    </div>
  );
}

export default function FiltrosCatalogo({ filtros, onCambiar, onLimpiar, opciones, activos = 0 }) {
  const [expandido, setExpandido] = useState(false);
  const [movilAbierto, setMovilAbierto] = useState(false);

  useEffect(() => {
    if (!movilAbierto) return undefined;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const cerrarEscape = (e) => { if (e.key === 'Escape') setMovilAbierto(false); };
    document.addEventListener('keydown', cerrarEscape);
    return () => {
      document.body.style.overflow = antes;
      document.removeEventListener('keydown', cerrarEscape);
    };
  }, [movilAbierto]);

  return (
    <>
      <div className="rounded-[1.8rem] border border-[#F1DDE5] bg-[#FFF9FB] p-4 shadow-[0_12px_30px_rgba(66,32,49,.04)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#A48C96]">Filtra tu estilo</p>
            <h3 className="mt-2 font-serif text-2xl font-semibold text-[#302730]">Luce <span className="italic text-[#FC4D84]">chingona.</span></h3>
            <p className="mt-1 text-sm text-[#907984]">Activa los filtros solo cuando los necesites.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setMovilAbierto(true); setExpandido(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#F0CED9] bg-white px-4 py-3 text-sm font-extrabold text-[#CA3F6E] lg:hidden"
            >
              <SlidersHorizontal size={17} /> Filtros {activos > 0 && <span className="rounded-full bg-[#FC4D84] px-2 text-xs text-white">{activos}</span>}
            </button>

            <div className="hidden lg:inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-[#C83E6E] shadow-sm">
              <Sparkles size={14} />
              {activos > 0 ? `${activos} filtro(s) activo(s)` : 'Filtros ocultos por defecto'}
            </div>

            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="hidden lg:inline-flex items-center gap-2 rounded-xl border border-[#F0CED9] bg-white px-4 py-3 text-sm font-extrabold text-[#CA3F6E] transition hover:bg-[#FFF0F5]"
            >
              <SlidersHorizontal size={17} />
              {expandido ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>

            {activos > 0 && (
              <button
                type="button"
                onClick={onLimpiar}
                className="inline-flex items-center gap-2 rounded-xl bg-[#302730] px-4 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#45363F]"
              >
                <RotateCcw size={14} /> Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {expandido && (
        <div className="mt-4 hidden rounded-[1.8rem] border border-[#F1DDE5] bg-white p-4 lg:block">
          <ContenidoFiltros filtros={filtros} onCambiar={onCambiar} opciones={opciones} onLimpiar={onLimpiar} activos={activos} />
        </div>
      )}

      {movilAbierto && createPortal(
        <div className="fixed inset-0 z-[110] lg:hidden" role="presentation">
          <button type="button" className="absolute inset-0 h-full w-full bg-[#22141D]/60" aria-label="Cerrar filtros" onClick={() => setMovilAbierto(false)} />
          <section role="dialog" aria-modal="true" aria-label="Filtros de prendas" className="absolute inset-y-0 right-0 flex w-[min(100%,430px)] flex-col bg-[#FEFEFE] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1E0E6] p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#A48C96]">LUDAROPE</p>
                <h3 className="mt-1 font-serif text-2xl font-semibold text-[#382A30]">Filtros</h3>
              </div>
              <button type="button" onClick={() => setMovilAbierto(false)} aria-label="Cerrar" className="rounded-full bg-[#FFF0F5] p-2 text-[#C43E69]">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ContenidoFiltros filtros={filtros} onCambiar={onCambiar} opciones={opciones} onLimpiar={onLimpiar} activos={activos} compacto />
            </div>
            <div className="flex gap-3 border-t border-[#F1E0E6] bg-white p-4">
              <button type="button" onClick={onLimpiar} className="rounded-xl border border-[#F1D4DF] px-4 py-3 text-sm font-bold text-[#C43E69]">Limpiar</button>
              <button type="button" onClick={() => setMovilAbierto(false)} className="flex-1 rounded-xl bg-[#FC4D84] px-4 py-3 text-sm font-black text-white">Ver resultados</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
