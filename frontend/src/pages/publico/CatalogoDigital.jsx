import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  ImageIcon,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import api from '../../api/axios';
import logo from '../../assets/logo.png';
import CarruselPrenda from '../../components/catalogo/CarruselPrenda';
import ProductoCatalogoModal from '../../components/catalogo/ProductoCatalogoModal';
import ChatbotDisponibilidad from '../../components/catalogo/ChatbotDisponibilidad';
import PortadaEditorial from '../../components/catalogo/PortadaEditorial';
import FiltrosCatalogo from '../../components/catalogo/FiltrosCatalogo';
import {
  fotosValidas,
  moneda,
  etiquetaOferta,
  normalizar,
  sucursalesDisponibles,
  unidadesDisponibles,
} from '../../components/catalogo/catalogoUtils';
import './catalogo-v5.css';

function TarjetaPrenda({ prenda, onVerDetalle, index }) {
  const fotos = fotosValidas(prenda);
  const tiendas = sucursalesDisponibles(prenda);
  const sucursalResumen = tiendas.length === 1
    ? tiendas[0].sucursal
    : tiendas.length > 1
      ? `${tiendas.length} sucursales`
      : 'Sin sucursal';

  return (
    <article className="ld5-reveal group min-w-0 overflow-hidden rounded-[1.7rem] border border-[#F3E1E8] bg-white shadow-[0_10px_32px_rgba(70,35,52,.05)] transition duration-300 hover:-translate-y-1 hover:border-[#F1BDD0] hover:shadow-[0_22px_48px_rgba(78,37,54,.12)]">
      <div className="relative p-3 pb-0">
        <div className="overflow-hidden rounded-[1.45rem] bg-[#FFF7FA]">
          <CarruselPrenda
            imagenes={fotos}
            nombre={prenda.nombre}
            formato="tarjeta"
            intervalo={4200 + (index % 4) * 450}
            onAbrir={() => onVerDetalle(prenda)}
          />
        </div>
        <div className="pointer-events-none absolute left-6 top-6 z-[2] rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.11em] text-[#D63E70] shadow-sm">
          {prenda.categoria}
        </div>
        <div className="pointer-events-none absolute right-6 top-6 z-[2] rounded-full bg-[#302730]/70 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm">
          {fotos.length > 1 ? `${fotos.length} fotos` : 'Nueva pieza'}
        </div>
      </div>

      <div className="space-y-4 p-4 pt-4 sm:p-5">
        {(prenda.ofertas||[]).length>0 && <div className="flex flex-wrap gap-1.5">{prenda.ofertas.slice(0,3).map(o=><span key={o.id_promocion} className="rounded-full bg-[#FC4D84] px-3 py-1 text-[10px] font-black text-white">{etiquetaOferta(o.etiqueta)}</span>)}</div>}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-serif text-[1.45rem] font-semibold leading-none text-[#302730] sm:text-[1.6rem]">
              {prenda.nombre}
            </h3>
            <span className="shrink-0 rounded-full bg-[#FFF3E9] px-3 py-1.5 text-[11px] font-extrabold text-[#B96531]">
              {unidadesDisponibles(prenda)} disponible(s)
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-[#9A818C]">
            Talla <span className="font-bold text-[#6B525D]">{prenda.talla}</span>
            <span className="mx-2 text-[#E7AA44]">·</span>
            {prenda.color}
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl bg-[#FFF9FB] p-3 sm:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl bg-[#FFF4F8] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#A48C96]">Precio</p>
            {prenda.precio_promocional!==null && prenda.precio_promocional!==undefined
              ? <><span className="block text-xs text-[#A68A97] line-through">{moneda(prenda.precio_venta)}</span><span className="mt-1 block break-words text-[2rem] font-black leading-none text-[#FC4D84]">{moneda(prenda.precio_promocional)}</span></>
              : <span className="mt-1 block break-words text-[2rem] font-black leading-none text-[#FC4D84]">{moneda(prenda.precio_venta)}</span>}
          </div>
         
        </div>

        {(prenda.ofertas||[]).some(o=>o.tipo==='NXM') && <p className="text-xs font-semibold text-[#B94372]">Oferta combinable al completar las prendas participantes. Consulta condiciones en tienda.</p>}
        <p className="flex items-start gap-2 text-sm leading-relaxed text-[#8B7480]">
          <MapPin size={16} className="mt-0.5 shrink-0 text-[#FE714B]" />
          <span className="line-clamp-2">{tiendas.length === 1 ? tiendas[0].sucursal : `Disponible en ${tiendas.length} sucursales`}</span>
        </p>

        <button
          type="button"
          onClick={() => onVerDetalle(prenda)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FC4D84] px-4 py-4 text-sm font-extrabold uppercase tracking-[.08em] text-white shadow-[0_10px_28px_rgba(252,77,132,.24)] transition hover:bg-[#E24074]"
        >
          Ver detalles <ArrowUpRight size={16} />
        </button>
      </div>
    </article>
  );
}

export default function CatalogoDigital() {
  const [prendas, setPrendas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [talla, setTalla] = useState('');
  const [color, setColor] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [orden, setOrden] = useState('recientes');
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [sugerencias, setSugerencias] = useState(false);

  const cargar = useCallback(async ({ inicial = false } = {}) => {
    try {
      if (inicial) setCargando(true);
      const { data } = await api.get('/catalogo/prendas');
      if (!data?.ok) throw new Error(data?.mensaje || 'No se pudo cargar el catálogo.');
      setPrendas(Array.isArray(data.prendas) ? data.prendas : []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.mensaje || e.message || 'No se pudo consultar el catálogo.');
    } finally {
      if (inicial) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar({ inicial: true });
    const intervalo = window.setInterval(() => {
      if (!document.hidden) cargar();
    }, 60000);
    const volver = () => {
      if (!document.hidden) cargar();
    };
    window.addEventListener('focus', volver);
    document.addEventListener('visibilitychange', volver);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', volver);
      document.removeEventListener('visibilitychange', volver);
    };
  }, [cargar]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const root = document.querySelector('.luda-catalogo');
    root?.classList.add('ld5-motion-ready');
    const observer = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('ld5-visible');
          observer.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -25px 0px' });
    document.querySelectorAll('.luda-catalogo .ld5-reveal:not(.ld5-visible)').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [prendas, busqueda, categoria, talla, color, sucursal, precioMin, precioMax, orden, cargando]);

  const categorias = useMemo(() => [...new Set(prendas.map((p) => p.categoria).filter(Boolean))].sort(), [prendas]);
  const tallas = useMemo(() => [...new Set(prendas.map((p) => p.talla).filter(Boolean))].sort(), [prendas]);
  const colores = useMemo(() => [...new Set(prendas.map((p) => p.color).filter(Boolean))].sort(), [prendas]);
  const sucursales = useMemo(
    () => [...new Set(prendas.flatMap((p) => sucursalesDisponibles(p).map((s) => s.sucursal)))].sort(),
    [prendas],
  );

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda);
    const desde = precioMin.trim() !== '' && Number.isFinite(Number(precioMin)) ? Math.max(0, Number(precioMin)) : null;
    const hasta = precioMax.trim() !== '' && Number.isFinite(Number(precioMax)) ? Math.max(0, Number(precioMax)) : null;

    return prendas
      .filter(
        (p) => (!categoria || p.categoria === categoria)
          && (!talla || p.talla === talla)
          && (!color || p.color === color)
          && (!sucursal || sucursalesDisponibles(p).some((s) => s.sucursal === sucursal))
          && (desde === null || Number(p.precio_venta) >= desde)
          && (hasta === null || Number(p.precio_venta) <= hasta)
          && (!q || normalizar([p.nombre, p.descripcion, p.categoria, p.talla, p.color].join(' ')).includes(q)),
      )
      .sort((a, b) => {
        if (orden === 'precio_asc') return Number(a.precio_venta) - Number(b.precio_venta);
        if (orden === 'precio_desc') return Number(b.precio_venta) - Number(a.precio_venta);
        if (orden === 'nombre') return String(a.nombre).localeCompare(String(b.nombre), 'es');
        return Number(b.id_prenda) - Number(a.id_prenda);
      });
  }, [prendas, busqueda, categoria, talla, color, sucursal, precioMin, precioMax, orden]);

  const resultadosSugeridos = useMemo(
    () => (busqueda.trim().length >= 2
      ? prendas
        .filter((p) => normalizar([p.nombre, p.categoria, p.talla, p.color].join(' ')).includes(normalizar(busqueda)))
        .slice(0, 5)
      : []),
    [prendas, busqueda],
  );

  useEffect(() => {
    if (seleccionado && !prendas.some((p) => p.id_prenda === seleccionado.id_prenda)) setSeleccionado(null);
  }, [prendas, seleccionado]);

  const prendaModal = seleccionado ? prendas.find((p) => p.id_prenda === seleccionado.id_prenda) || null : null;
  const filtrosActivos = [categoria, talla, color, sucursal, precioMin, precioMax].filter(Boolean).length + Number(orden !== 'recientes');
  const cambiarFiltro = (campo, valor) => ({
    categoria: setCategoria,
    talla: setTalla,
    color: setColor,
    sucursal: setSucursal,
    precioMin: setPrecioMin,
    precioMax: setPrecioMax,
    orden: setOrden,
  })[campo]?.(valor);

  const filtros = { categoria, talla, color, sucursal, precioMin, precioMax, orden };
  const cerrarModal = useCallback(() => setSeleccionado(null), []);
  const limpiar = () => {
    setBusqueda('');
    setCategoria('');
    setTalla('');
    setColor('');
    setSucursal('');
    setPrecioMin('');
    setPrecioMax('');
    setOrden('recientes');
    setSugerencias(false);
  };
  const irColeccion = () => document.getElementById('coleccion')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="luda-catalogo min-h-screen min-w-0 overflow-x-hidden bg-[#FEFEFE] font-sans text-[#302730]">
      <div className="bg-[#302730] px-3 py-2.5 text-center text-[10px] font-extrabold uppercase tracking-[.22em] text-[#FEFEFE] sm:text-xs">
        <Sparkles size={14} className="mr-2 inline text-[#E7AA44]" />
        Piezas especiales · Moda con personalidad · Disponibilidad real
      </div>

      <header className="border-b border-[#F3E0E7] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-[81px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Logo LUDAROPE" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
            <div>
              <p className="text-base font-black tracking-[.16em] text-[#302730] sm:text-lg">LUDAROPE</p>
              <p className="text-[11px] font-medium text-[#AC828E]">Moda para descubrir</p>
            </div>
          </div>
          <div className="hidden items-center gap-7 text-xs font-bold uppercase tracking-wider text-[#775E6B] md:flex">
            <a href="#coleccion" className="hover:text-[#FC4D84]">Colección</a>
            <a href="#categorias" className="hover:text-[#FC4D84]">Categorías</a>
            <a href="#coleccion" className="hover:text-[#FC4D84]">Disponibilidad</a>
          </div>
          <button type="button" onClick={irColeccion} className="inline-flex items-center gap-1.5 rounded-full bg-[#FC4D84] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#DF356C] sm:px-5">
            Explorar <ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      <main>
        <PortadaEditorial
          cantidad={prendas.length}
          onExplorar={irColeccion}
          onBuscar={() => {
            irColeccion();
            window.setTimeout(() => document.getElementById('buscar-catalogo')?.focus(), 400);
          }}
        />
        <div className="ld5-marquee-wrap overflow-hidden border-y border-[#F5D6E1] bg-[#FFF0F5] py-4" aria-label="LUDAROPE: estilo, color y piezas únicas">
          <div className="ld5-marquee inline-flex w-max items-center gap-9 whitespace-nowrap">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} aria-hidden={i > 0 ? 'true' : undefined} className="flex items-center gap-9">
                <span className="font-serif text-xl italic text-[#C83F6F]">Piezas únicas</span>
                <Sparkles size={15} className="text-[#FE714B]" />
                <span className="text-[11px] font-black uppercase tracking-[.22em] text-[#9B697A]">Encuentra tu estilo</span>
                <Sparkles size={15} className="text-[#E7AA44]" />
                <span className="font-serif text-xl italic text-[#C83F6F]">Colores con personalidad</span>
                <Sparkles size={15} className="text-[#FE714B]" />
              </div>
            ))}
          </div>
        </div>
        <section id="categorias" className="ld5-categories border-y border-[#F2DFE6] bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-5 sm:px-6 lg:px-8">
            <span className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-widest text-[#A68B97]">Explora:</span>
            <button type="button" onClick={() => setCategoria('')} className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-extrabold transition ${!categoria ? 'border-[#FC4D84] bg-[#FC4D84] text-white' : 'border-[#F0DCE4] bg-white text-[#765E6A] hover:border-[#FC4D84]'}`}>Todas</button>
            {categorias.map((c) => <button type="button" key={c} onClick={() => setCategoria(c)} className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-extrabold transition ${categoria === c ? 'border-[#FC4D84] bg-[#FC4D84] text-white' : 'border-[#F0DCE4] bg-white text-[#765E6A] hover:border-[#FC4D84]'}`}>{c}</button>)}
          </div>
        </section>

        <section id="coleccion" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-11 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#FE714B]">Encuentra tu estilo</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-[#302730] sm:text-4xl">Colección disponible<span className="text-[#FC4D84]">.</span></h2>
              <p className="mt-2 text-sm text-[#9B838D]">Selecciona una prenda para descubrir más fotografías y consultar sucursales.</p>
            </div>
            <span className="rounded-full bg-[#FFF0F5] px-4 py-2 text-xs font-bold text-[#CA3F6E]">{filtradas.length} resultado(s)</span>
          </div>

          <div className="relative z-20 mb-5 rounded-[1.5rem] border border-[#F1DDE5] bg-[#FFF9FB] p-3 shadow-[0_10px_30px_rgba(65,32,48,.04)] sm:p-4">
            <div className="relative min-w-0">
              <div className="flex items-center rounded-2xl border border-[#F0D9E2] bg-white focus-within:border-[#FC4D84] focus-within:ring-4 focus-within:ring-[#FC4D84]/10">
                <Search size={19} className="ml-4 shrink-0 text-[#FC4D84]" />
                <input
                  id="buscar-catalogo"
                  autoComplete="off"
                  type="search"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setSugerencias(true); }}
                  onFocus={() => setSugerencias(true)}
                  onBlur={() => window.setTimeout(() => setSugerencias(false), 160)}
                  placeholder="Busca por prenda, talla, categoría o color..."
                  aria-label="Buscar prendas"
                  className="min-w-0 w-full bg-transparent px-3 py-4 text-sm text-[#3D2C35] outline-none"
                />
              </div>
              {sugerencias && busqueda.trim().length >= 2 && (
                <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#F0DBE3] bg-white p-1.5 shadow-xl">
                  {resultadosSugeridos.length ? resultadosSugeridos.map((p) => (
                    <button
                      type="button"
                      key={p.id_prenda}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setBusqueda(p.nombre); setSugerencias(false); setSeleccionado(p); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#FFF4F7]"
                    >
                      <span className="flex-1 truncate text-sm font-bold text-[#3D3038]">
                        {p.nombre}<span className="ml-2 text-xs font-normal text-[#A18591]">{p.talla} · {p.color}</span>
                      </span>
                      <span className="shrink-0 text-xs font-black text-[#FC4D84]">{moneda(p.precio_venta)}</span>
                    </button>
                  )) : <p className="px-3 py-4 text-xs text-[#987F89]">Sin coincidencias</p>}
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 mb-6 space-y-3">
            <FiltrosCatalogo
              filtros={filtros}
              onCambiar={cambiarFiltro}
              onLimpiar={limpiar}
              opciones={{ categorias, tallas, colores, sucursales }}
              activos={filtrosActivos}
            />
          </div>

          {error && (
            <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#F6D1D8] bg-[#FFF1F3] px-5 py-4 text-sm text-[#AA3F52]">
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => cargar({ inicial: true })} className="flex items-center gap-1 font-bold"><RefreshCw size={16} />Reintentar</button>
            </div>
          )}

          {cargando ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-[#F3E4E8]">
                  <div className="aspect-[4/5] bg-[#FFF0F5]" />
                  <div className="space-y-3 p-4"><div className="h-4 rounded bg-[#F6E9EF]" /><div className="h-4 w-2/3 rounded bg-[#F6E9EF]" /></div>
                </div>
              ))}
            </div>
          ) : filtradas.length ? (
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtradas.map((p, i) => <TarjetaPrenda key={p.id_prenda} prenda={p} index={i} onVerDetalle={setSeleccionado} />)}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[#F1CBD8] bg-[#FFF8FA] px-5 py-14 text-center">
              <ImageIcon size={36} className="mx-auto text-[#FC4D84]" />
              <h3 className="mt-3 font-serif text-2xl text-[#302730]">No encontramos prendas</h3>
              <p className="mt-2 text-sm text-[#9C828E]">Prueba otra búsqueda o revisa de nuevo más adelante.</p>
              <button type="button" onClick={limpiar} className="mt-5 rounded-xl bg-[#FC4D84] px-5 py-3 text-sm font-bold text-white">Ver toda la colección</button>
            </div>
          )}

          <p className="mt-7 text-center text-xs leading-6 text-[#A08B96]">Existencias sujetas a cambios. El catálogo se actualiza periódicamente mientras permanece abierto.</p>
        </section>

        <section className="bg-[#302730] px-4 py-12 text-white sm:px-6">
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#E7AA44]">Piezas con personalidad</p>
              <h2 className="mt-3 max-w-2xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">Encuentra esa prenda que se siente <span className="italic text-[#FC4D84]">muy tú.</span></h2>
              <p className="mt-3 text-sm leading-7 text-white/65">Consulta tallas, colores, fotografías y disponibilidad antes de acercarte a tu sucursal.</p>
            </div>
            <button type="button" onClick={irColeccion} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FE714B] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#FF751F]">Explorar prendas <ArrowDown size={17} /></button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#F1DFE4] bg-white px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex items-center gap-3"><img src={logo} alt="" className="h-10 w-10 object-contain" /><div><p className="text-lg font-black tracking-widest">LUDAROPE</p><p className="mt-1 text-xs text-[#947B85]">Catálogo digital · Moda y estilo</p></div></div>
          <p className="text-xs leading-relaxed text-[#A08993]">Los precios y las existencias pueden variar. Consulta en la sucursal antes de tu visita.</p>
        </div>
      </footer>

      <ChatbotDisponibilidad prendas={prendas} onVerDetalle={setSeleccionado} />
      <ProductoCatalogoModal prenda={prendaModal} onCerrar={cerrarModal} />
    </div>
  );
}
