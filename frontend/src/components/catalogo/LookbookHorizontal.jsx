import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { fotosValidas, moneda } from './catalogoUtils';

const moodboards = [
  { etiqueta: '01 / ESTILO', titulo: 'Looks pensados para destacar', fondo: 'from-[#FFF2F6] to-[#FFF8FA]' },
  { etiqueta: '02 / COLOR', titulo: 'Explora tonos, texturas y detalles', fondo: 'from-[#FFF1E8] to-[#FFFAF5]' },
  { etiqueta: '03 / BOUTIQUE', titulo: 'Prendas con personalidad propia', fondo: 'from-[#FFF7E7] to-[#FFFCF4]' },
];

export default function LookbookHorizontal({ prendas = [], onVerDetalle, onExplorar }) {
  const disponibles = useMemo(() => {
    const conFoto = prendas.filter((p) => fotosValidas(p).length > 0);
    return [...conFoto]
      .sort((a, b) => Number(Boolean(b.destacada)) - Number(Boolean(a.destacada)) || Number(b.id_prenda) - Number(a.id_prenda))
      .slice(0, 8);
  }, [prendas]);

  const [actual, setActual] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [reducido, setReducido] = useState(false);
  const total = disponibles.length;
  const haySlides = total > 0;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducido(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (!haySlides || pausa || reducido || total < 2) return undefined;
    const id = window.setTimeout(() => {
      if (!document.hidden) setActual((v) => (v + 1) % total);
    }, 5500);
    return () => window.clearTimeout(id);
  }, [actual, total, haySlides, pausa, reducido]);

  useEffect(() => {
    if (actual >= total && total > 0) setActual(0);
  }, [actual, total]);

  const activa = haySlides ? disponibles[actual] : null;
  const anteriores = haySlides
    ? Array.from({ length: Math.min(3, total) }, (_, idx) => disponibles[(actual + idx + 1) % total])
    : [];

  return (
    <section className="ld5-lookbook relative overflow-hidden border-y border-[#F4E4E9] bg-white py-14 sm:py-20" aria-label="Selección visual LUDAROPE">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-[#FC4D84]/[.05] blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-[#E7AA44]/[.08] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="ld5-reveal mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.26em] text-[#E14C77]"><Sparkles size={16} /> El lookbook</p>
            <h2 className="mt-3 max-w-2xl font-serif text-[clamp(2.4rem,5vw,4.7rem)] font-semibold leading-[.98] tracking-[-.045em] text-[#302730]">Una colección <span className="italic text-[#FC4D84]">muy tú.</span></h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#8B7380]">Una sección más visual para descubrir prendas, ver cambios automáticos y entrar al detalle desde una experiencia tipo boutique.</p>
          </div>
          {haySlides && total > 1 && (
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" aria-label="Ver prendas anteriores" onClick={() => setActual((n) => (n - 1 + total) % total)} className="grid h-12 w-12 place-items-center rounded-full border border-[#F1D7E0] bg-white text-[#C93D6E] transition hover:-translate-y-0.5 hover:bg-[#FFF1F6]"><ChevronLeft size={21} /></button>
              <button type="button" aria-label="Ver siguientes prendas" onClick={() => setActual((n) => (n + 1) % total)} className="grid h-12 w-12 place-items-center rounded-full bg-[#FC4D84] text-white shadow-[0_9px_28px_rgba(252,77,132,.25)] transition hover:-translate-y-0.5 hover:bg-[#E33D73]"><ChevronRight size={21} /></button>
            </div>
          )}
        </div>

        {haySlides ? (
          <div className="ld5-reveal grid items-stretch gap-6 xl:grid-cols-[1.45fr_.85fr]" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
            <button
              type="button"
              onClick={() => onVerDetalle?.(activa)}
              className="group relative min-h-[540px] overflow-hidden rounded-[2.2rem] border border-[#F1DFE6] bg-[#FFF5F8] text-left shadow-[0_22px_48px_rgba(58,24,43,.10)] transition hover:-translate-y-1 hover:shadow-[0_26px_54px_rgba(58,24,43,.14)]"
            >
              <div className="absolute inset-0">
                <img
                  key={`${activa?.id_prenda}-${actual}`}
                  src={fotosValidas(activa)[0]}
                  alt={activa?.nombre}
                  className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#24121B]/76 via-[#24121B]/22 to-[#24121B]/12" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.18),transparent_32%)]" />
              </div>

              <div className="relative flex h-full flex-col justify-between p-6 text-white sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/95 px-4 py-2 text-[10px] font-black uppercase tracking-[.17em] text-[#CC3D70] shadow-sm">{activa.categoria}</span>
                    <span className="rounded-full bg-white/18 px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-white backdrop-blur-sm">{actual + 1} / {total}</span>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-[#FC4D84] shadow-sm transition group-hover:scale-110"><ArrowUpRight size={20} /></span>
                </div>

                <div className="max-w-[560px]">
                  <p className="text-[11px] font-black uppercase tracking-[.22em] text-white/80">Colección destacada</p>
                  <h3 className="mt-3 font-serif text-[clamp(2.5rem,4vw,4.4rem)] font-semibold leading-[.93] tracking-[-.04em]">{activa.nombre}</h3>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-white/75">{activa.descripcion || 'Prenda disponible en catálogo digital con fotos reales, tallas y colores visibles para una compra más clara.'}</p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur-sm">Talla {activa.talla}</span>
                    <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur-sm">{activa.color}</span>
                    <span className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold backdrop-blur-sm">{moneda(activa.precio_venta)}</span>
                  </div>
                </div>
              </div>
            </button>

            <div className="grid gap-4">
              <div className="rounded-[2rem] border border-[#F2E2E8] bg-[#FFF9FB] p-5 shadow-[0_12px_30px_rgba(59,25,42,.05)]">
                <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#A68B97]">Sigue explorando</p>
                <div className="mt-4 space-y-3">
                  {anteriores.map((item, idx) => (
                    <button
                      type="button"
                      key={`${item.id_prenda}-${idx}`}
                      onClick={() => setActual((actual + idx + 1) % total)}
                      className="group flex w-full items-center gap-3 rounded-[1.35rem] border border-[#F3E3E9] bg-white p-3 text-left transition hover:border-[#F0BFD0] hover:bg-[#FFF4F8]"
                    >
                      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-[1rem] bg-[#FFF1F6]">
                        <img src={fotosValidas(item)[0]} alt={item.nombre} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#C94172]">{item.categoria}</p>
                        <p className="mt-1 line-clamp-2 font-serif text-xl font-semibold leading-none text-[#302730]">{item.nombre}</p>
                        <p className="mt-2 text-sm text-[#8A7380]">Talla {item.talla} · {item.color}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                {moodboards.map((item) => (
                  <div key={item.etiqueta} className={`overflow-hidden rounded-[1.75rem] border border-[#F2E2E8] bg-gradient-to-br ${item.fondo} p-5`}>
                    <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9A7F8D]">{item.etiqueta}</p>
                    <h3 className="mt-3 font-serif text-[1.75rem] font-semibold leading-tight text-[#302730]">{item.titulo}</h3>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="ld5-reveal grid gap-4 sm:grid-cols-3 sm:gap-5">
            {moodboards.map((item) => (
              <div key={item.etiqueta} className={`relative min-h-[260px] overflow-hidden rounded-[1.8rem] border border-[#F2E2E8] bg-gradient-to-br ${item.fondo} p-6 sm:min-h-[320px] sm:p-7`}>
                <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full border-[26px] border-white/50 opacity-60" />
                <p className="relative text-[11px] font-black uppercase tracking-[.2em] text-[#9A7F8D]">{item.etiqueta}</p>
                <h3 className="relative mt-16 max-w-[260px] font-serif text-[2.4rem] font-semibold leading-[.98] tracking-[-.045em] text-[#302730]">{item.titulo}</h3>
              </div>
            ))}
          </div>
        )}

        {haySlides && total > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2" role="group" aria-label="Elegir diapositiva del lookbook">
            {disponibles.map((p, i) => (
              <button
                key={p.id_prenda}
                type="button"
                onClick={() => setActual(i)}
                aria-label={`Mostrar ${p.nombre}`}
                aria-current={i === actual ? 'true' : undefined}
                className={`h-2 rounded-full transition-all duration-300 ${i === actual ? 'w-10 bg-[#FC4D84]' : 'w-2 bg-[#EBD8DF] hover:bg-[#FE714B]'}`}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <button type="button" onClick={onExplorar} className="group inline-flex items-center gap-2 rounded-full border border-[#F0CED9] bg-[#FFF9FB] px-6 py-3.5 text-sm font-black text-[#C93D6E] transition hover:border-[#FC4D84] hover:bg-[#FFF0F5]">Ver toda la colección <ArrowUpRight size={16} className="transition group-hover:translate-x-1 group-hover:-translate-y-1" /></button>
        </div>
      </div>
    </section>
  );
}
