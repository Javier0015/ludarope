import { ArrowDownRight, ArrowUpRight, MoveDown, Sparkles, Star, Shirt } from 'lucide-react';

/** Portada de marca: deliberadamente NO utiliza fotos del inventario. */
export default function PortadaEditorial({ onExplorar, onBuscar, cantidad = 0 }) {
  return (
    <section className="ld5-hero relative isolate overflow-hidden bg-[#FFFAFB]" aria-label="Bienvenida al catálogo LUDAROPE">
      <div className="ld5-hero-wash pointer-events-none absolute inset-0" />
      <div className="ld5-drift pointer-events-none absolute -left-16 top-20 h-64 w-64 rounded-full border-[27px] border-[#FC4D84]/10 sm:h-80 sm:w-80" />
      <div className="ld5-drift-alt pointer-events-none absolute -right-20 bottom-5 h-72 w-72 rounded-full border-[33px] border-[#E7AA44]/12" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(252,77,132,.11)_1px,transparent_0)] [background-size:30px_30px] opacity-30" />

      <div className="relative mx-auto flex min-h-[540px] max-w-7xl flex-col items-center justify-center px-5 py-20 text-center sm:min-h-[620px] sm:px-8 lg:py-24">
        <div className="ld5-rise inline-flex items-center gap-2 rounded-full border border-[#F3D3DE] bg-white/90 px-4 py-2 shadow-sm">
          <Sparkles size={15} className="text-[#FE714B]" />
          <span className="text-[10px] font-black uppercase tracking-[.24em] text-[#C53B6B] sm:text-xs">Estilo chingón, actitud chingona.</span>
        </div>

        <div className="relative mt-7 w-full max-w-5xl">
          <span className="ld5-orbit pointer-events-none absolute left-[1%] top-[9%] hidden h-14 w-14 items-center justify-center rounded-full bg-[#E7AA44] text-white shadow-[0_12px_35px_rgba(231,170,68,.18)] sm:flex lg:left-[7%]">
            <Star size={22} fill="currentColor" />
          </span>
          <span className="ld5-orbit-alt pointer-events-none absolute bottom-[10%] right-[1%] hidden h-16 w-16 items-center justify-center rounded-full border-[2px] border-[#FE714B] text-[#FE714B] sm:flex lg:right-[10%]">
            <Shirt size={25} />
          </span>
          <h1 className="ld5-title font-serif font-semibold leading-[.88] tracking-[-.065em] text-[#302730]">
            <span className="ld5-rise block">Luce</span>
            <span className="ld5-rise-delay relative mt-2 block italic text-[#FC4D84] sm:mt-3">
              chingona.
              <span className="pointer-events-none absolute -bottom-4 left-1/2 h-2 w-[60%] -translate-x-1/2 rounded-[100%] bg-[#FE714B]/24 blur-sm sm:-bottom-5" />
            </span>
          </h1>
        </div>

        <p className="ld5-rise-late mt-12 max-w-[720px] text-sm leading-7 text-[#846B76] sm:text-[17px] sm:leading-8">
          Prendas con personalidad, colores con actitud y piezas para que armes un look auténtico, bonito y bien chingón.
        </p>

        <div className="ld5-rise-late mt-8 flex w-full flex-wrap items-center justify-center gap-3">
          <button onClick={onExplorar} type="button" className="ld5-btnshine group inline-flex items-center justify-center gap-2 rounded-full bg-[#FC4D84] px-7 py-4 text-sm font-black text-white shadow-[0_15px_30px_rgba(252,77,132,.24)] transition hover:-translate-y-1 hover:bg-[#E33A70]">
            Ver prendas chingonas <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          <button onClick={onBuscar} type="button" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#EFCBD6] bg-white/90 px-7 py-4 text-sm font-bold text-[#AA3865] shadow-sm transition hover:-translate-y-1 hover:border-[#FC4D84] hover:bg-white">
            Buscar una prenda <ArrowDownRight size={17} />
          </button>
        </div>

        <div className="ld5-rise-late mt-10 inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#A48B96]">
          <span className="h-px w-8 bg-[#E3BFCC]" />
          {cantidad > 0 ? `${cantidad} prendas para descubrir` : 'Colección en preparación'}
          <span className="h-px w-8 bg-[#E3BFCC]" />
        </div>
        <MoveDown className="ld5-bounce mt-7 text-[#FC4D84]" size={20} aria-hidden="true" />
      </div>
    </section>
  );
}
