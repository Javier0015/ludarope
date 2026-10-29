import { useEffect, useMemo, useState } from 'react';
import { CameraOff, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Tarjetas: carrusel automático con transición más suave.
 * Modal: versión completa con flechas, miniaturas y contador.
 */
export default function CarruselPrenda({
  imagenes = [],
  nombre = 'Prenda',
  formato = 'tarjeta',
  intervalo = 4700,
  onAbrir,
  className = '',
  children,
}) {
  const [actual, setActual] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [movimientoReducido, setMovimientoReducido] = useState(false);

  const imagenesMemo = useMemo(() => imagenes.filter(Boolean), [imagenes]);
  const total = imagenesMemo.length;
  const indice = total ? actual % total : 0;
  const modal = formato === 'modal';
  const tarjeta = formato === 'tarjeta';
  const ratio = modal ? 'aspect-[5/5] sm:aspect-[5/4.6] lg:aspect-[4/4.3]' : 'aspect-[4/5]';

  useEffect(() => {
    setActual(0);
  }, [imagenesMemo.join('|')]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sincronizar = () => setMovimientoReducido(mq.matches);
    sincronizar();
    mq.addEventListener?.('change', sincronizar);
    return () => mq.removeEventListener?.('change', sincronizar);
  }, []);

  useEffect(() => {
    if (total < 2 || pausa || movimientoReducido) return undefined;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setActual((n) => (n + 1) % total);
    }, intervalo);
    return () => window.clearTimeout(timer);
  }, [actual, total, pausa, intervalo, movimientoReducido]);

  const anterior = (e) => {
    e?.stopPropagation();
    setActual((n) => (n - 1 + total) % total);
  };

  const siguiente = (e) => {
    e?.stopPropagation();
    setActual((n) => (n + 1) % total);
  };

  return (
    <div
      className={`min-w-0 overflow-hidden ${className}`}
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onFocusCapture={() => setPausa(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPausa(false);
      }}
    >
      <div className={`group relative isolate overflow-hidden rounded-[1.55rem] bg-[#FFF3F7] ${ratio}`}>
        {total ? (
          imagenesMemo.map((src, i) => {
            const activa = i === indice;
            return (
              <div
                key={`${src}-${i}`}
                className={`absolute inset-0 transition-[opacity,transform] duration-[850ms] ease-out ${activa ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-2 opacity-0'}`}
                aria-hidden={!activa}
              >
                <img
                  src={src}
                  alt={activa ? `${nombre}, fotografía ${i + 1}` : ''}
                  loading={modal && i === 0 ? 'eager' : 'lazy'}
                  className={`h-full w-full ${modal ? 'object-contain bg-[#FFF8FA]' : 'object-cover'} transition-transform duration-[4200ms] ease-linear ${activa ? 'scale-100' : 'scale-[1.04]'}`}
                />
                {!modal && (
                  <>
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#24151F]/42 via-[#24151F]/10 to-transparent" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.18),transparent_35%)]" />
                  </>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#FFF0F5] to-[#FFF5E5] text-[#FC4D84]">
            <CameraOff size={36} strokeWidth={1.5} />
            <span className="text-xs font-semibold">Imagen no disponible</span>
          </div>
        )}

        {tarjeta && total > 1 && (
          <>
            <div className="pointer-events-none absolute left-4 right-4 top-4 z-[2] h-1.5 overflow-hidden rounded-full bg-white/45 backdrop-blur-sm">
              <div
                key={`progreso-${indice}`}
                className="h-full rounded-full bg-[#FC4D84]"
                style={{ animation: pausa ? 'none' : `ludaropeProgress ${intervalo}ms linear forwards` }}
              />
            </div>

            <button
              type="button"
              onClick={anterior}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 z-[3] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#362630] opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 hover:bg-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={siguiente}
              aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 z-[3] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/88 text-[#362630] opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 hover:bg-white"
            >
              <ChevronRight size={18} />
            </button>

            <div className="absolute bottom-4 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#302730]/65 px-3 py-2 backdrop-blur-sm">
              {imagenesMemo.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActual(i);
                  }}
                  aria-label={`Ir a fotografía ${i + 1}`}
                  aria-current={i === indice ? 'true' : undefined}
                  className={`h-1.5 rounded-full transition-all ${i === indice ? 'w-6 bg-[#FC4D84]' : 'w-1.5 bg-white/70 hover:bg-white'}`}
                />
              ))}
            </div>
          </>
        )}

        {children}

        {onAbrir && (
          <button
            type="button"
            onClick={onAbrir}
            aria-label={`Ver detalles de ${nombre}`}
            className="absolute inset-0 z-[1] cursor-pointer focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#FC4D84]"
          />
        )}

        {modal && total > 1 && (
          <>
            <button
              type="button"
              onClick={anterior}
              aria-label="Fotografía anterior"
              className="absolute left-3 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-[#362630] shadow-sm transition hover:bg-[#FC4D84] hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={siguiente}
              aria-label="Fotografía siguiente"
              className="absolute right-3 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-[#362630] shadow-sm transition hover:bg-[#FC4D84] hover:text-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {modal && total > 0 && (
          <span className="pointer-events-none absolute left-3 top-3 z-[2] rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-extrabold text-[#5C4350] shadow-sm">
            {indice + 1} / {total}
          </span>
        )}
      </div>

      {modal && total > 1 && (
        <div className="mt-3 flex justify-center gap-2" aria-label="Miniaturas de la prenda">
          {imagenesMemo.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Mostrar fotografía ${i + 1}`}
              aria-current={i === indice ? 'true' : undefined}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition sm:h-16 sm:w-16 ${i === indice ? 'border-[#FC4D84] shadow-md' : 'border-[#F2DCE5] opacity-75 hover:opacity-100'}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes ludaropeProgress { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}
