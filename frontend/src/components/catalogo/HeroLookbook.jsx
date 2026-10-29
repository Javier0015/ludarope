import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CircleDot,
  ImageIcon,
  MapPin,
  Sparkles,
  Tag,
} from 'lucide-react';
import { fotosValidas, moneda, sucursalesDisponibles } from './catalogoUtils';

const tarjetaThumb = [
  'rotate-[-7deg] translate-y-4',
  'rotate-[1deg] translate-y-0',
  'rotate-[8deg] translate-y-5',
];

/**
 * Escaparate visual sin una fotografía gigante fija.
 * Muestra una composición de mini tarjetas y la prenda destacada.
 */
export default function HeroLookbook({ prendas = [], onVerDetalle, logo }) {
  const destacados = useMemo(() => {
    const conFoto = prendas.filter((p) => fotosValidas(p).length > 0);
    return [...conFoto]
      .sort((a, b) => Number(Boolean(b.destacada)) - Number(Boolean(a.destacada)) || Number(b.id_prenda) - Number(a.id_prenda))
      .slice(0, 8);
  }, [prendas]);

  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = destacados.length;

  useEffect(() => {
    if (total < 2 || pausado) return undefined;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setActual((n) => (n + 1) % total);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [actual, pausado, total]);

  useEffect(() => {
    if (actual >= total && total) setActual(0);
  }, [actual, total]);

  const activa = total ? destacados[actual] : null;
  const panel = total
    ? [0, 1, 2].map((offset) => destacados[(actual + offset) % total]).filter(Boolean)
    : [];

  return (
    <div
      className="relative mx-auto w-full max-w-[620px]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPausado(false);
      }}
    >
      <div className="pointer-events-none absolute -right-3 top-6 h-40 w-40 rounded-full bg-[#FC4D84]/12 blur-3xl" />
      <div className="pointer-events-none absolute -left-8 bottom-2 h-40 w-40 rounded-full bg-[#E7AA44]/20 blur-3xl" />

      <div className="relative overflow-hidden rounded-[2rem] border border-[#F3DEE6] bg-white/90 p-4 shadow-[0_24px_70px_rgba(74,37,53,.12)] backdrop-blur-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.22em] text-[#CA3B6D]">
            <Sparkles size={16} className="text-[#FE714B]" />
            Lookbook LUDAROPE
          </div>
          <div className="rounded-full bg-[#FFF1F6] px-3 py-1.5 text-[11px] font-extrabold text-[#A95B78]">
            {total ? `${String(actual + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : 'Sin piezas'}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
          <div className="relative overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-[#FFF2F7] via-[#FEFEFE] to-[#FFF4E8] p-4 sm:p-5">
            <div className="absolute right-4 top-4 h-20 w-20 rounded-full border border-[#F6D6DF] opacity-60" />
            <div className="absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-[#FE714B]/10 blur-2xl" />
            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#A18A94]">
                Colección en movimiento
              </p>
              <div className="relative mt-4 h-[255px] sm:h-[290px]">
                {panel.length ? (
                  panel.map((prenda, idx) => {
                    const foto = fotosValidas(prenda)[0];
                    return (
                      <button
                        key={`${prenda.id_prenda}-${idx}`}
                        type="button"
                        onClick={() => onVerDetalle?.(prenda)}
                        className={`absolute left-1/2 top-0 w-[70%] max-w-[220px] -translate-x-1/2 overflow-hidden rounded-[1.55rem] border border-white/70 bg-white shadow-[0_18px_35px_rgba(62,34,48,.16)] transition duration-500 hover:-translate-y-1 ${tarjetaThumb[idx] || ''}`}
                      >
                        <div className="aspect-[4/5] overflow-hidden bg-[#FFF0F5]">
                          {foto ? (
                            <img
                              src={foto}
                              alt=""
                              className={`h-full w-full object-cover transition duration-[1400ms] ${idx === 1 ? 'scale-100 opacity-100' : 'scale-[1.03] opacity-80'}`}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[#FC4D84]">
                              {logo ? (
                                <img src={logo} alt="" className="h-16 w-16 object-contain opacity-70" />
                              ) : (
                                <ImageIcon size={40} />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#342832]">{prenda.nombre}</p>
                            <p className="mt-0.5 truncate text-[11px] text-[#8A7380]">{prenda.categoria}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#FFF1F6] px-2 py-1 text-[10px] font-black text-[#C73D6C]">
                            {prenda.talla}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-dashed border-[#F1D5DE] bg-white/65 px-6 text-center">
                    {logo ? <img src={logo} alt="" className="h-20 w-20 object-contain opacity-80" /> : <ImageIcon size={48} className="text-[#FC4D84]" />}
                    <p className="font-serif text-2xl text-[#543541]">Muy pronto, nuevas piezas.</p>
                    <p className="max-w-xs text-xs leading-6 text-[#8B6E7A]">Las prendas publicadas con fotografía aparecerán aquí.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[1.7rem] border border-[#F2DFE7] bg-[#FFFBFC] p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#FFF0F5] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-[#C93C6E]">
                  {activa?.categoria || 'Colección'}
                </span>
                {activa && (
                  <span className="rounded-full bg-[#FFF6ED] px-3 py-1.5 text-[10px] font-bold text-[#B16A34]">
                    {sucursalesDisponibles(activa).length} sucursal(es)
                  </span>
                )}
              </div>

              <h2 className="mt-4 font-serif text-[clamp(1.8rem,3vw,2.4rem)] font-semibold leading-tight text-[#302730]">
                {activa?.nombre || 'Encuentra tu próximo favorito'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#7A6770]">
                {activa?.descripcion || 'Una selección visual con prendas reales, colores y tallas listas para descubrir.'}
              </p>

              {activa && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#F4E3E8] bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#A18B95]">Precio</p>
                    <p className="mt-1 text-2xl font-black text-[#FC4D84]">{moneda(activa.precio_venta)}</p>
                  </div>
                  <div className="rounded-2xl border border-[#F4E3E8] bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#A18B95]">Disponible</p>
                    <p className="mt-1 text-sm font-bold text-[#3A2B33]">{activa.talla} · {activa.color}</p>
                    <p className="mt-1 text-xs text-[#8E7782]">{sucursalesDisponibles(activa).map((s) => s.sucursal).join(', ')}</p>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#7F6A74]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 font-semibold shadow-sm"><Tag size={14} className="text-[#FE714B]" /> Tallas y colores reales</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 font-semibold shadow-sm"><MapPin size={14} className="text-[#E7AA44]" /> Disponibilidad por sucursal</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 font-semibold shadow-sm"><CircleDot size={14} className="text-[#FC4D84]" /> Catálogo actualizado</span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => activa && onVerDetalle?.(activa)}
                  disabled={!activa}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 text-sm font-black text-white shadow-[0_10px_28px_rgba(252,77,132,.24)] transition hover:bg-[#E24174] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ver detalles <ArrowUpRight size={16} />
                </button>
                {total > 1 && (
                  <button
                    type="button"
                    onClick={() => setActual((n) => (n + 1) % total)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#F2D4DE] bg-white px-4 py-3 text-sm font-extrabold text-[#CB3F6E] transition hover:bg-[#FFF1F6]"
                  >
                    Ver otra pieza
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[#F2DFE7] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#A18A94]">Vista previa</p>
                {total > 1 && (
                  <p className="text-[11px] font-semibold text-[#A18A94]">Las piezas cambian automáticamente</p>
                )}
              </div>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {destacados.slice(0, 6).map((prenda, idx) => {
                  const foto = fotosValidas(prenda)[0];
                  const activo = idx === actual;
                  return (
                    <button
                      key={prenda.id_prenda}
                      type="button"
                      onClick={() => setActual(idx)}
                      className={`group min-w-[100px] flex-1 rounded-[1.15rem] border p-2 text-left transition ${activo ? 'border-[#FC4D84] bg-[#FFF5F8] shadow-md' : 'border-[#F3E0E7] bg-white hover:border-[#F0C7D5]'}`}
                    >
                      <div className="aspect-[1/1] overflow-hidden rounded-xl bg-[#FFF0F5]">
                        {foto ? <img src={foto} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-[#FC4D84]"><ImageIcon size={24} /></div>}
                      </div>
                      <p className="mt-2 line-clamp-1 text-xs font-black text-[#392B33]">{prenda.nombre}</p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-[#8A7480]">{prenda.color} · {prenda.talla}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
