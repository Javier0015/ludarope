import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  ChevronRight,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  Shirt,
  Sparkles,
  Store,
  Tags,
  X,
} from 'lucide-react';
import {
  fotosValidas,
  moneda,
  normalizar,
  sucursalesDisponibles,
  unidadesDisponibles,
} from './catalogoUtils';

/**
 * Chat de ayuda del catálogo público LUDAROPE.
 * No llama a servicios de IA: interpreta consultas sobre la información
 * pública recibida del endpoint /api/catalogo/prendas a través de `prendas`.
 */
const MENU = [
  {
    id: 'buscar',
    titulo: 'Buscar una prenda',
    descripcion: 'Dime qué buscas y reviso las prendas disponibles.',
    icono: Search,
    color: 'rosa',
  },
  {
    id: 'novedades',
    titulo: 'Ver novedades',
    descripcion: 'Descubre las últimas piezas que llegaron.',
    icono: Sparkles,
    color: 'coral',
  },
  {
    id: 'categorias',
    titulo: 'Explorar categorías',
    descripcion: 'Vestidos, blusas, accesorios y más.',
    icono: Tags,
    color: 'dorado',
  },
  {
    id: 'sucursales',
    titulo: 'Consultar sucursales',
    descripcion: 'Mira dónde hay prendas disponibles.',
    icono: Store,
    color: 'verde',
  },
];

const ESTILOS_OPCION = {
  rosa: 'bg-[#FFF0F5] text-[#D43E72] border-[#FAD6E2]',
  coral: 'bg-[#FFF1EB] text-[#E96C48] border-[#FADCD1]',
  dorado: 'bg-[#FFF7E5] text-[#B88022] border-[#F7E7C0]',
  verde: 'bg-[#EDF8F3] text-[#228F69] border-[#D0F0E0]',
};

const STOPWORDS = /\b(hola|holi|buenas|buenos|dias|tardes|noches|busco|buscar|quiero|quisiera|necesito|tienen|tiene|hay|prenda|prendas|producto|productos|por|favor|necesito|un|una|en|de|del|la|las|el|los|talla|tallas|color|colores|disponibilidad|disponibles|sucursal|me|mostrar|muestrame|alguna|algun|que|con|para)\b/g;
const UNICOS = (valores) => [...new Set(valores.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
const escaparRegExp = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const palabraCompleta = (texto, termino) => new RegExp(`(^|\\s)${escaparRegExp(termino)}(?=\\s|$)`).test(texto);
const esperar = (ms) => new Promise((resolver) => window.setTimeout(resolver, ms));
const demora = (texto, reducido) => reducido ? 80 : Math.min(1850, Math.max(850, 750 + String(texto || '').length * 13));

function Avatar() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[#F8D1DF] bg-[#FFF0F6] text-[#FC4D84] shadow-sm">
      <Bot size={19} strokeWidth={2.1} />
    </span>
  );
}

function Escribiendo({ estado }) {
  return (
    <div className="luda-chat-entra flex items-start gap-2.5" role="status" aria-live="polite">
      <Avatar />
      <div className="rounded-2xl rounded-tl-md border border-[#F0E0E6] bg-white px-4 py-3 shadow-sm">
        <div className="mb-2 text-[11px] font-semibold text-[#9A818C]">{estado || 'Escribiendo...'}</div>
        <div className="flex h-3 items-center gap-[6px]" aria-label="El asistente está escribiendo">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="luda-chat-punto h-2.5 w-2.5 rounded-full bg-[#FC4D84]"
              style={{ animationDelay: `${i * 170}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TarjetaOpcion({ accion, onClick, disabled }) {
  const Icono = accion.icono;
  return (
    <button
      type="button"
      onClick={() => onClick(accion)}
      disabled={disabled}
      className="luda-chat-opcion group flex w-full items-center gap-3 rounded-2xl border border-[#EFE2E7] bg-white p-3 text-left shadow-[0_3px_8px_rgba(64,28,49,.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#F4BDD0] hover:shadow-[0_9px_20px_rgba(64,28,49,.10)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${ESTILOS_OPCION[accion.color]}`}>
        <Icono size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-black text-[#32242F]">{accion.titulo}</span>
        <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-[#8C7984]">{accion.descripcion}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-[#D5B7C4] transition group-hover:translate-x-1 group-hover:text-[#FC4D84]" />
    </button>
  );
}

function FichaPrenda({ prenda, onVerDetalle }) {
  const foto = fotosValidas(prenda)[0];
  const tiendas = sucursalesDisponibles(prenda);
  return (
    <button
      type="button"
      onClick={() => onVerDetalle?.(prenda)}
      className="group flex w-full items-center gap-3 rounded-xl border border-[#F1DCE4] bg-[#FFFAFB] p-2.5 text-left transition hover:border-[#FC4D84] hover:bg-[#FFF3F8]"
    >
      <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-[#FFF0F5]">
        {foto ? <img src={foto} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <Shirt size={24} className="mx-auto mt-5 text-[#FC4D84]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-black leading-snug text-[#342730]">{prenda.nombre}</p>
        <p className="mt-1 truncate text-[11px] text-[#957A87]">{prenda.talla} · {prenda.color}</p>
        <p className="mt-1 text-[13px] font-black text-[#FC4D84]">{moneda(prenda.precio_venta)}</p>
        <p className="mt-1 line-clamp-1 text-[10px] text-[#9A858E]">
          {tiendas.length === 1 ? tiendas[0].sucursal : `${tiendas.length} sucursal(es)`}
        </p>
      </div>
      <ArrowUpRight size={16} className="shrink-0 text-[#E75B87]" />
    </button>
  );
}

export default function ChatbotDisponibilidad({ prendas = [], onVerDetalle }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [entrada, setEntrada] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [estado, setEstado] = useState('Escribiendo...');
  const [modo, setModo] = useState('libre');
  const [movimientoReducido, setMovimientoReducido] = useState(false);
  const [secuenciaInicio, setSecuenciaInicio] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const inicioRealizadoRef = useRef(false);
  const sesionRef = useRef(0);
  const idRef = useRef(0);
  const procesandoRef = useRef(false);
  const scrollRef = useRef(null);
  const crearId = () => `luda-mensaje-${++idRef.current}`;

  const categorias = useMemo(() => UNICOS(prendas.map((p) => p.categoria)), [prendas]);
  const tallas = useMemo(() => UNICOS(prendas.map((p) => p.talla)), [prendas]);
  const colores = useMemo(() => UNICOS(prendas.map((p) => p.color)), [prendas]);
  const sucursales = useMemo(() => UNICOS(prendas.flatMap((p) => sucursalesDisponibles(p).map((s) => s.sucursal))), [prendas]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sincronizar = () => setMovimientoReducido(media.matches);
    sincronizar();
    media.addEventListener?.('change', sincronizar);
    return () => media.removeEventListener?.('change', sincronizar);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const contenedor = scrollRef.current;
    if (contenedor) contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: movimientoReducido ? 'instant' : 'smooth' });
  }, [abierto, mensajes, escribiendo, movimientoReducido]);

  const publicar = (mensaje) => setMensajes((previos) => [...previos, { id: crearId(), ...mensaje }]);
  const usuarioDice = (texto) => publicar({ tipo: 'usuario', texto });

  const responder = async (pasos) => {
    if (procesandoRef.current) return false;
    procesandoRef.current = true;
    setOcupado(true);
    const sesion = sesionRef.current;
    try {
      for (const paso of pasos) {
        if (sesion !== sesionRef.current) return false;
        setEstado(paso.estado || 'Escribiendo...');
        setEscribiendo(true);
        await esperar(demora(paso.texto, movimientoReducido));
        if (sesion !== sesionRef.current) return false;
        publicar({ tipo: 'bot', ...paso });
        setEscribiendo(false);
        if (pasos.length > 1 && !movimientoReducido) await esperar(190);
      }
      return sesion === sesionRef.current;
    } finally {
      if (sesion === sesionRef.current) {
        procesandoRef.current = false;
        setEscribiendo(false);
        setOcupado(false);
      }
    }
  };

  useEffect(() => {
    if (!abierto || inicioRealizadoRef.current) return;
    inicioRealizadoRef.current = true;
    responder([
      { texto: '¡Hola! ✨ Soy tu asistente de LUDAROPE.', estado: 'Escribiendo...' },
      { texto: '¿Qué te gustaría consultar?', menu: true, estado: 'Preparando opciones...' },
      { texto: 'Elige una opción o dime qué prenda estás buscando. 😊', estado: 'Escribiendo...' },
    ]);
    // El inicio se dispara exclusivamente al abrir o reiniciar el chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, secuenciaInicio]);

  const reiniciar = () => {
    sesionRef.current += 1;
    procesandoRef.current = false;
    inicioRealizadoRef.current = false;
    setMensajes([]);
    setEntrada('');
    setModo('libre');
    setEscribiendo(false);
    setOcupado(false);
    setSecuenciaInicio((x) => x + 1);
  };

  const evaluar = (consulta, filtros = {}) => {
    const texto = normalizar(consulta).replace(/[¿?¡!,.;:]/g, ' ').replace(/\s+/g, ' ').trim();
    const coincidir = (lista) => [...lista].sort((a, b) => String(b).length - String(a).length)
      .find((valor) => palabraCompleta(texto, normalizar(valor))) || '';
    const categoria = filtros.categoria || coincidir(categorias);
    const color = filtros.color || coincidir(colores);
    const sucursal = filtros.sucursal || coincidir(sucursales);
    const talla = filtros.talla || [...tallas].sort((a, b) => String(b).length - String(a).length)
      .find((valor) => new RegExp(`\\btalla\\s+${escaparRegExp(normalizar(valor))}(?=\\s|$)`).test(texto)) || '';

    let resto = texto;
    [categoria, talla, color, sucursal].filter(Boolean).forEach((valor) => {
      resto = resto.replace(new RegExp(`(^|\\s)${escaparRegExp(normalizar(valor))}(?=\\s|$)`, 'g'), ' ');
    });
    const palabras = resto.replace(STOPWORDS, ' ').replace(/\s+/g, ' ').trim().split(' ').filter((v) => v.length > 2);
    const resultados = prendas.filter((p) => {
      const textoPrenda = normalizar([p.nombre, p.categoria, p.color, p.talla, p.descripcion].join(' '));
      return (!categoria || normalizar(p.categoria) === normalizar(categoria))
        && (!color || normalizar(p.color) === normalizar(color))
        && (!talla || normalizar(p.talla) === normalizar(talla))
        && (!sucursal || sucursalesDisponibles(p).some((s) => normalizar(s.sucursal) === normalizar(sucursal)))
        && unidadesDisponibles(p) > 0
        && palabras.every((palabra) => textoPrenda.includes(palabra));
    });
    return { resultados, categoria, talla, color, sucursal };
  };

  const buscar = (texto, filtros = {}) => {
    const r = evaluar(texto, filtros);
    const especificos = [r.categoria, r.talla ? `talla ${r.talla}` : '', r.color, r.sucursal].filter(Boolean).join(' · ');
    const mensajeResultado = r.resultados.length
      ? `Encontré ${r.resultados.length} prenda${r.resultados.length === 1 ? '' : 's'} disponible${r.resultados.length === 1 ? '' : 's'}${especificos ? ` de ${especificos}` : ''}. Mira estas opciones:`
      : 'No encontré prendas disponibles con esos criterios. Podemos probar otra talla, color o categoría.';
    return responder([
      { texto: 'Voy a revisar las prendas que coincidan con tu búsqueda. 🔎', estado: 'Analizando tu búsqueda...' },
      { texto: mensajeResultado, resultados: r.resultados.slice(0, 5), accionesFinales: true, estado: 'Consultando el catálogo...' },
    ]);
  };

  const accionesCategorias = (tipo, valores) => valores.map((valor) => ({ tipo, valor }));

  const ejecutarAccion = (accion) => {
    if (procesandoRef.current) return;
    usuarioDice(accion.titulo);
    if (accion.id === 'buscar') {
      setModo('buscar');
      responder([{ texto: '¿Qué prenda tienes en mente? Puedes escribir algo como «vestido rosa talla M».', estado: 'Preparando búsqueda...' }]);
    } else if (accion.id === 'novedades') {
      const nuevas = [...prendas].filter((p) => unidadesDisponibles(p) > 0)
        .sort((a, b) => Number(b.id_prenda) - Number(a.id_prenda)).slice(0, 5);
      responder([
        { texto: 'Revisaré las últimas prendas disponibles. ✨', estado: 'Buscando novedades...' },
        { texto: nuevas.length ? 'Estas son algunas de las novedades más recientes:' : 'Por ahora no hay novedades publicadas.', resultados: nuevas, accionesFinales: true, estado: 'Organizando prendas...' },
      ]);
    } else if (accion.id === 'categorias') {
      responder([{ texto: categorias.length ? 'Estas son las categorías con prendas publicadas. Elige una:' : 'Todavía no hay categorías disponibles.', opciones: accionesCategorias('categoria', categorias), estado: 'Consultando categorías...' }]);
    } else if (accion.id === 'sucursales') {
      responder([{ texto: sucursales.length ? '¿En qué sucursal quieres buscar prendas?' : 'Por ahora no hay existencias publicadas por sucursal.', opciones: accionesCategorias('sucursal', sucursales), estado: 'Revisando sucursales...' }]);
    }
  };

  const ejecutarOpcion = (opcion) => {
    if (procesandoRef.current) return;
    usuarioDice(opcion.valor);
    buscar(opcion.tipo === 'talla' ? `talla ${opcion.valor}` : opcion.valor, { [opcion.tipo]: opcion.valor });
  };

  const verTallas = () => {
    if (procesandoRef.current) return;
    usuarioDice('Buscar por talla');
    responder([{ texto: tallas.length ? 'Selecciona una talla para ver las prendas disponibles:' : 'Aún no hay tallas disponibles.', opciones: accionesCategorias('talla', tallas), estado: 'Revisando tallas...' }]);
  };

  const verMenu = () => {
    if (procesandoRef.current) return;
    usuarioDice('Volver al menú');
    responder([{ texto: '¡Claro! ¿Qué te gustaría consultar ahora?', menu: true, estado: 'Preparando opciones...' }]);
  };

  const enviar = (evento) => {
    evento.preventDefault();
    const texto = entrada.trim();
    if (!texto || procesandoRef.current) return;
    setEntrada('');
    setModo('libre');
    usuarioDice(texto);
    const limpio = normalizar(texto);
    if (/^(hola|holi|buenas|buen dia|buenos dias|buenas tardes|buenas noches)\b/.test(limpio)) {
      responder([{ texto: '¡Hola! 😊 ¿Buscas una prenda en especial?', menu: true, estado: 'Escribiendo...' }]);
    } else if (/^(gracias|muchas gracias|te agradezco)\b/.test(limpio)) {
      responder([{ texto: '¡Con gusto! ✨ Cuando necesites otra prenda, aquí estaré.', accionesFinales: true, estado: 'Escribiendo...' }]);
    } else if (/\b(whatsapp|telefono|contacto|llamar)\b/.test(limpio)) {
      responder([{ texto: 'Todavía no tenemos un contacto de WhatsApp configurado aquí. Puedes abrir los detalles de cada prenda para ver en qué sucursal está disponible.', accionesFinales: true, estado: 'Revisando opciones...' }]);
    } else if (/\b(promo|promociones|ofertas|descuentos)\b/.test(limpio)) {
      responder([{ texto: 'Las promociones aún no están configuradas. Si gustas, puedo mostrarte las últimas prendas disponibles.', accionesFinales: true, estado: 'Revisando catálogo...' }]);
    } else if (/^(menu|menú|ayuda|opciones|que puedes hacer|como funciona)\b/.test(limpio)) {
      responder([{ texto: 'Estas son las opciones con las que puedo ayudarte:', menu: true, estado: 'Preparando opciones...' }]);
    } else {
      buscar(texto);
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-[950] sm:bottom-5 sm:right-5">
      <style>{`
        @keyframes ludaChatPunto { 0%,15%,55%,100% { transform: translateY(0); opacity: .40; } 34% { transform: translateY(-5px); opacity: 1; } }
        @keyframes ludaChatEntrada { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ludaChatPulso { 0%,100% { box-shadow: 0 12px 32px rgba(252,77,132,.23); } 50% { box-shadow: 0 16px 42px rgba(252,77,132,.38); } }
        .luda-chat-punto { animation: ludaChatPunto 1.2s ease-in-out infinite; }
        .luda-chat-entra, .luda-chat-opcion { animation: ludaChatEntrada .30s ease-out both; }
        .luda-chat-abrir { animation: ludaChatPulso 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .luda-chat-punto,.luda-chat-entra,.luda-chat-opcion,.luda-chat-abrir { animation: none !important; } }
      `}</style>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir asistente LUDAROPE"
          className="luda-chat-abrir group inline-flex items-center gap-3 rounded-full bg-[#FC4D84] px-4 py-3.5 font-extrabold text-white transition hover:-translate-y-1 hover:bg-[#E33D74] sm:px-5"
        >
          <span className="relative"><MessageCircle size={23} /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#FC4D84] bg-[#E7AA44]" /></span>
          <span className="hidden text-sm sm:inline">¿Te ayudo a buscar?</span>
        </button>
      ) : (
        <section
          role="dialog"
          aria-label="Asistente del catálogo LUDAROPE"
          className="flex h-[min(760px,calc(100dvh-1.5rem))] w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.9rem] border border-[#F2DCE4] bg-white shadow-[0_22px_68px_rgba(50,25,42,.26)] sm:h-[min(760px,calc(100dvh-3rem))]"
        >
          <header className="relative shrink-0 overflow-hidden bg-gradient-to-r from-[#FC4D84] via-[#EE517E] to-[#FE714B] px-4 pb-5 pt-4 text-white">
            <div className="pointer-events-none absolute -right-9 -top-16 h-40 w-40 rounded-full border-[25px] border-white/10" />
            <div className="pointer-events-none absolute -left-16 -bottom-24 h-40 w-40 rounded-full bg-[#E7AA44]/20" />
            <div className="relative flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/50 bg-white/90 text-[#FC4D84] shadow-md"><Bot size={26} /></span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black">Asistente LUDAROPE</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/95">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D4F6DC] shadow-[0_0_0_3px_rgba(255,255,255,.13)]" />
                    En línea · Catálogo digital
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={reiniciar} title="Reiniciar conversación" aria-label="Reiniciar conversación" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white transition hover:bg-white/25"><RotateCcw size={18} /></button>
                <button type="button" onClick={() => setAbierto(false)} title="Cerrar" aria-label="Cerrar asistente" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white transition hover:bg-white/25"><X size={21} /></button>
              </div>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#FFF9FB] px-3.5 py-4 sm:px-4">
            {mensajes.map((mensaje) => (
              <div key={mensaje.id} className={`luda-chat-entra flex items-start gap-2.5 ${mensaje.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                {mensaje.tipo !== 'usuario' && <Avatar />}
                <div className={`${mensaje.tipo === 'usuario' ? 'max-w-[83%]' : 'min-w-0 max-w-[calc(100%_-_46px)] flex-1'}`}>
                  <div className={`rounded-2xl px-4 py-3 text-[13px] font-medium leading-[1.65] shadow-sm ${mensaje.tipo === 'usuario' ? 'rounded-tr-md bg-[#FC4D84] font-semibold text-white' : 'rounded-tl-md border border-[#F1E0E7] bg-white text-[#46363F]'}`}>
                    {mensaje.texto}
                  </div>
                  {mensaje.menu && (
                    <div className="mt-2.5 space-y-2.5">
                      {MENU.map((accion) => <TarjetaOpcion key={accion.id} accion={accion} disabled={ocupado} onClick={ejecutarAccion} />)}
                    </div>
                  )}
                  {mensaje.opciones?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mensaje.opciones.map((opcion) => (
                        <button
                          key={`${opcion.tipo}-${opcion.valor}`}
                          type="button"
                          onClick={() => ejecutarOpcion(opcion)}
                          disabled={ocupado}
                          className="rounded-xl border border-[#F2C5D5] bg-white px-3 py-2 text-xs font-bold text-[#C63E6B] transition hover:bg-[#FFF0F5] disabled:opacity-45"
                        >{opcion.valor}</button>
                      ))}
                    </div>
                  )}
                  {mensaje.resultados?.length > 0 && (
                    <div className="mt-3 space-y-2.5">
                      {mensaje.resultados.map((p) => <FichaPrenda key={p.id_prenda} prenda={p} onVerDetalle={onVerDetalle} />)}
                    </div>
                  )}
                  {mensaje.accionesFinales && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button type="button" onClick={() => ejecutarAccion(MENU[0])} disabled={ocupado} className="rounded-xl border border-[#F0C8D7] bg-white px-3 py-2 text-[11px] font-extrabold text-[#BD3D6D] disabled:opacity-50">Buscar otra prenda</button>
                      <button type="button" onClick={verMenu} disabled={ocupado} className="rounded-xl border border-[#F0C8D7] bg-white px-3 py-2 text-[11px] font-extrabold text-[#BD3D6D] disabled:opacity-50">Volver al menú</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {escribiendo && <Escribiendo estado={estado} />}
          </div>

          <div className="shrink-0 border-t border-[#F4E3E8] bg-white px-3.5 pb-3.5 pt-3 sm:px-4">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => ejecutarAccion(MENU[0])} disabled={ocupado} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3 py-2 text-[11px] font-bold text-[#C73E70] hover:bg-[#FFE4ED] disabled:opacity-40"><Search size={13} /> Buscar</button>
              <button type="button" onClick={verTallas} disabled={ocupado} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3 py-2 text-[11px] font-bold text-[#C73E70] hover:bg-[#FFE4ED] disabled:opacity-40"><Shirt size={13} /> Tallas</button>
              <button type="button" onClick={verMenu} disabled={ocupado} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3 py-2 text-[11px] font-bold text-[#C73E70] hover:bg-[#FFE4ED] disabled:opacity-40"><RotateCcw size={13} /> Menú</button>
            </div>
            <form onSubmit={enviar} className="relative">
              <input
                type="text"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                disabled={ocupado}
                aria-label="Escribe una pregunta para el asistente"
                placeholder={modo === 'buscar' ? 'Ej. vestido rosa talla M' : 'Escribe una prenda o pregunta...'}
                className="w-full rounded-2xl border border-[#EDDCE3] bg-[#FFF9FB] py-3.5 pl-4 pr-14 text-[13px] text-[#46363F] outline-none transition focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FFF0F5] disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={ocupado || !entrada.trim()}
                aria-label="Enviar mensaje"
                className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl bg-[#FC4D84] text-white transition hover:bg-[#E33D74] disabled:cursor-not-allowed disabled:bg-[#D7CAD1]"
              ><Send size={18} /></button>
            </form>
            <p className="mt-2 text-[10px] leading-relaxed text-[#A08B95]">
              <Store size={12} className="mr-1 inline text-[#E7AA44]" />
              Asistente automático basado en el catálogo; confirma existencias con la sucursal.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
