import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Banknote, Barcode, CheckCircle2, ChevronDown, CreditCard, Download, ImageOff,
  Loader2, Mail, Minus, Package, Plus, RefreshCw, Search, ShieldCheck,
  ShoppingBag, ShoppingCart, Store, Trash2, Wallet, X, Leaf, LockKeyhole,
  CalendarClock, ReceiptText, ArrowRight, Sparkles, Tag,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import './pos.css';

const METODOS = [
  { id: 'EFECTIVO', nombre: 'Efectivo', Icon: Banknote },
  { id: 'DEBITO', nombre: 'Débito', Icon: CreditCard },
  { id: 'CREDITO', nombre: 'Crédito', Icon: CreditCard },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia', Icon: Wallet },
];
const peso = (v) => Number(v || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const centavos = (v) => Math.round((Number(v) || 0) * 100);
const dinero = (c) => (c / 100).toFixed(2);
const entero = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const apiRoot = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
const fotoUrl = (ruta) => {
  if (!ruta) return '';
  if (/^https?:\/\//i.test(ruta)) return ruta;
  if (/^\/\//.test(ruta)) return '';
  return `${apiRoot}${String(ruta).startsWith('/') ? '' : '/'}${ruta}`;
};
const primeraFoto = (p) => fotoUrl(p.foto || p.fotos?.[0]);
const idCarrito = (prenda) => Number(prenda.id_prenda);

function Producto({ prenda, onAgregar, disponible }) {
  const foto = primeraFoto(prenda);
  return (
    <article className="ldpos-product group overflow-hidden rounded-[1.5rem] border border-[#F0DCE5] bg-white shadow-[0_8px_28px_rgba(82,38,61,.045)] transition duration-200 hover:-translate-y-1 hover:border-[#F7B8CE] hover:shadow-[0_18px_35px_rgba(82,38,61,.09)]">
      <div className="relative aspect-[5/4] overflow-hidden bg-[#FFF2F6]">
        {foto ? <img src={foto} alt={prenda.nombre} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" /> : <div className="grid h-full place-items-center text-[#E7A5BB]"><ImageOff size={36} /></div>}
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-[#C53A6B] shadow-sm">{prenda.categoria}</div>
        {(prenda.ofertas||[]).length>0 && <span className="absolute bottom-3 left-3 rounded-full bg-[#FC4D84] px-3 py-1 text-[10px] font-black text-white">{prenda.ofertas[0].etiqueta}</span>}
        <div className="absolute right-3 top-3 rounded-full bg-[#302730]/80 px-2.5 py-1 text-[10px] font-bold text-white">{prenda.stock_actual} pza.</div>
      </div>
      <div className="space-y-2.5 p-3.5 sm:p-4">
        <p className="line-clamp-1 text-sm font-extrabold text-[#392C35]">{prenda.nombre}</p>
        <p className="text-xs text-[#917A85]">Talla {prenda.talla} · {prenda.color}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-black text-[#FC4D84]">{peso(prenda.precio_venta)}</p>
          <button disabled={!disponible} type="button" onClick={() => onAgregar(prenda)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FC4D84] text-white shadow-[0_6px_16px_rgba(252,77,132,.2)] transition hover:bg-[#DE386D] disabled:cursor-not-allowed disabled:bg-[#E6CCD6]" aria-label={`Agregar ${prenda.nombre} al carrito`}><Plus size={19}/></button>
        </div>
        <p className="font-mono text-[10px] tracking-wide text-[#B09AA5]">{prenda.codigo}</p>
        {prenda.codigo_barras && <p className="break-all text-[10px] font-semibold text-[#9A6B80]">Código de barras: {prenda.codigo_barras}</p>}
      </div>
    </article>
  );
}

function Carrito({ carrito, total, subtotal, descuento, promociones, verificando, onCantidad, onQuitar, onCobrar, disabled, onLimpiar }) {
  const unidades = carrito.reduce((sum, p) => sum + p.cantidad, 0);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.7rem] border border-[#EDDCE4] bg-white shadow-[0_15px_45px_rgba(66,32,49,.065)]">
      <div className="border-b border-[#F4E4EA] bg-gradient-to-r from-[#FFF6F9] to-white px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5"><ShoppingCart size={20} className="text-[#FC4D84]"/><h2 className="font-black text-[#352A30]">Carrito de venta</h2></div>
          <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#BE456F] shadow-sm">{unidades} {unidades === 1 ? 'prenda' : 'prendas'}</span>
        </div>
      </div>
      <div className="ldpos-cart-scroll min-h-[170px] flex-1 space-y-3 overflow-y-auto p-4">
        {!carrito.length && (
          <div className="flex min-h-[210px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#EDD7E0] bg-[#FFF9FB] p-5 text-center">
            <ShoppingBag size={34} className="text-[#E8A6BC]"/>
            <p className="text-sm font-bold text-[#65505A]">Tu carrito está vacío</p>
            <p className="text-xs leading-5 text-[#AB949F]">Busca una prenda y agrégala para comenzar la venta.</p>
          </div>
        )}
        {carrito.map((p) => (
          <div key={p.id_prenda} className="flex gap-3 rounded-2xl border border-[#F3E4EA] bg-white p-3">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[#FFF4F8]">
              {primeraFoto(p) ? <img src={primeraFoto(p)} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center"><Package size={22} className="text-[#DEA0B5]"/></div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-xs font-extrabold text-[#3D3038]">{p.nombre}</p>
                <button type="button" onClick={() => onQuitar(p.id_prenda)} className="shrink-0 rounded-lg p-1 text-[#B39AA5] hover:bg-[#FFF0F5] hover:text-[#FC4D84]" aria-label="Quitar prenda"><Trash2 size={16}/></button>
              </div>
              <p className="mt-1 text-[11px] text-[#96808A]">{p.talla} · {p.color}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-xl border border-[#F2DFE7] p-1">
                  <button type="button" onClick={() => onCantidad(p.id_prenda, -1)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-[#FFF0F5]" aria-label="Quitar una unidad"><Minus size={13}/></button>
                  <span className="min-w-5 text-center text-xs font-black">{p.cantidad}</span>
                  <button type="button" onClick={() => onCantidad(p.id_prenda, 1)} disabled={p.cantidad >= Number(p.stock_actual)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-[#FFF0F5] disabled:opacity-40" aria-label="Agregar una unidad"><Plus size={13}/></button>
                </div>
                <span className="text-sm font-black text-[#FC4D84]">{peso(centavos(p.precio_venta) * p.cantidad / 100)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[#F2E3E9] bg-[#FFF9FB] p-5">
        <div className="flex items-center justify-between text-xs text-[#8A7380]"><span>Subtotal</span><span>{peso(subtotal / 100)}</span></div>
        {descuento > 0 && <div className="mt-2 flex items-center justify-between text-sm font-extrabold text-emerald-700"><span>Ahorras con ofertas</span><span>-{peso(descuento / 100)}</span></div>}
        {(promociones || []).map(p => <p key={p.id_promocion} className="mt-1 text-[11px] font-semibold text-[#BB3D70]">✦ {p.nombre} · −{peso(p.descuento)}</p>)}
        {verificando && <p className="mt-1 text-xs text-[#907583]">Calculando promociones vigentes…</p>}
        <div className="mt-3 flex items-center justify-between"><span className="font-black text-[#392B34]">Total</span><span className="text-[1.7rem] font-black text-[#FC4D84]">{peso(total / 100)}</span></div>
        <button disabled={disabled || !carrito.length} onClick={onCobrar} type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-4 font-black text-white shadow-[0_12px_25px_rgba(252,77,132,.2)] transition hover:bg-[#DE386F] disabled:cursor-not-allowed disabled:opacity-50"><CreditCard size={19}/> Cobrar {peso(total / 100)} <ArrowRight size={18}/></button>
        {carrito.length > 0 && <button type="button" onClick={onLimpiar} className="mt-3 w-full text-center text-xs font-bold text-[#997D88] hover:text-[#D13D70]">Vaciar carrito</button>}
      </div>
    </div>
  );
}

function CampoDinero({ label, value, onChange, disabled = false }) {
  return <label className="block"><span className="mb-2 block text-[11px] font-extrabold uppercase tracking-wide text-[#856B77]">{label}</span><div className="flex items-center overflow-hidden rounded-xl border border-[#F0D8E1] bg-white px-3 focus-within:border-[#FC4D84]"><span className="text-sm font-bold text-[#B995A4]">$</span><input type="number" min="0" step="0.01" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="min-w-0 w-full bg-transparent px-2 py-3 text-sm font-bold text-[#40323A] outline-none disabled:opacity-60"/></div></label>;
}

export default function POS() {
  const { usuario } = useAuth();
  const rolAdmin = usuario?.rol === 'ADMIN';
  const [sucursales, setSucursales] = useState([]);
  const [idSucursal, setIdSucursal] = useState(rolAdmin ? '' : String(usuario?.id_sucursal || ''));
  const [sesion, setSesion] = useState(null);
  const [cajas, setCajas] = useState([]);
  const [idCaja, setIdCaja] = useState('');
  const [prendas, setPrendas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [carritoMovil, setCarritoMovil] = useState(false);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [efectivoInicial, setEfectivoInicial] = useState('0');
  const [operandoCaja, setOperandoCaja] = useState(false);
  const [cobrarModal, setCobrarModal] = useState(false);
  const [metodo, setMetodo] = useState('EFECTIVO');
  const [mixto, setMixto] = useState(false);
  const [recibido, setRecibido] = useState('');
  const [pagosMixtos, setPagosMixtos] = useState({ DEBITO: '', CREDITO: '', TRANSFERENCIA: '' });
  const [cobrando, setCobrando] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [email, setEmail] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const llavePendiente = useRef(null);
  const searchRef = useRef(null);
  const subtotal = useMemo(() => carrito.reduce((s, p) => s + centavos(p.precio_venta) * p.cantidad, 0), [carrito]);
  const [simulacion,setSimulacion] = useState(null);
  const [errorPromocion,setErrorPromocion] = useState('');
  const firmaCarrito = useMemo(() => `${idSucursal}:` + carrito.map(p => `${p.id_prenda}x${p.cantidad}@${p.precio_venta}`).sort().join(','), [idSucursal,carrito]);
  const vigente = simulacion?.firma === firmaCarrito;
  const total = carrito.length ? (vigente ? centavos(simulacion.resultado.total) : subtotal) : 0;
  const descuento = vigente ? centavos(simulacion.resultado.descuento_total) : 0;
  const promociones = vigente ? simulacion.resultado.promociones : [];
  const verificandoPromociones = carrito.length > 0 && !vigente;
  const cantidadCarrito = carrito.reduce((s, p) => s + p.cantidad, 0);

  useEffect(() => {
    if (!carrito.length || !idSucursal) { setSimulacion(null); setErrorPromocion(''); return undefined; }
    const controlador = new AbortController();
    const temporizador = setTimeout(async () => {
      try {
        setErrorPromocion('');
        const {data} = await api.post('/promociones/simular', {
          id_sucursal:Number(idSucursal), items:carrito.map(p=>({id_prenda:p.id_prenda,cantidad:p.cantidad})),
        },{signal:controlador.signal});
        if (!controlador.signal.aborted) setSimulacion({firma:firmaCarrito,resultado:data});
      } catch(e) {
        if (!controlador.signal.aborted) {setSimulacion(null);setErrorPromocion(e.response?.data?.mensaje || 'No se pudo calcular la promoción.');}
      }
    },180);
    return () => {clearTimeout(temporizador);controlador.abort();};
  },[firmaCarrito,carrito,idSucursal]);


  const cargarSucursales = useCallback(async () => {
    try {
      const { data } = await api.get('/pos/sucursales');
      const lista = Array.isArray(data.sucursales) ? data.sucursales : [];
      setSucursales(lista);
      setIdSucursal((actual) => lista.some((s) => String(s.id_sucursal) === actual) ? actual : String(lista[0]?.id_sucursal || ''));
    } catch (e) { Swal.fire('Error', e.response?.data?.mensaje || 'No se pudieron cargar sucursales.', 'error'); }
  }, []);

  const cargarCajas = useCallback(async (sucursal) => {
    if (!entero(sucursal)) { setCajas([]); setIdCaja(''); return; }
    try {
      const { data } = await api.get('/caja/cajas', { params: { id_sucursal: sucursal } });
      const lista = data.cajas || [];
      setCajas(lista);
      setIdCaja((actual) => lista.some((c) => String(c.id_caja) === actual) ? actual : String(lista[0]?.id_caja || ''));
    } catch (e) { setCajas([]); setIdCaja(''); Swal.fire('Error', e.response?.data?.mensaje || 'No se pudieron cargar cajas.', 'error'); }
  }, []);

  const refrescar = useCallback(async (sucursal, q = '', cajaId) => {
    if (!entero(sucursal) || !entero(cajaId)) return;
    setCargando(true);
    try {
      const [{ data: inv }, { data: ses }, { data: reciente }] = await Promise.all([
        api.get('/pos/prendas', { params: { id_sucursal: sucursal, buscar: q.trim() } }),
        api.get('/pos/sesion', { params: { id_sucursal: sucursal, id_caja: cajaId } }),
        api.get('/pos/ventas', { params: { id_sucursal: sucursal } }),
      ]);
      setPrendas(inv.prendas || []);
      setSesion(ses.sesion || null);
      setHistorial(reciente.ventas || []);
    } catch (e) { Swal.fire('Error', e.response?.data?.mensaje || 'No se pudo cargar el POS.', 'error'); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargarSucursales(); }, [cargarSucursales]);
  useEffect(() => { cargarCajas(idSucursal); }, [idSucursal, cargarCajas]);
  useEffect(() => {
    setCarrito([]); setBuscar(''); setTicket(null); llavePendiente.current = null; setSesion(null);
  }, [idSucursal, idCaja]);
  useEffect(() => {
    if (!idSucursal || !idCaja) { setSesion(null); return undefined; }
    const t = window.setTimeout(() => refrescar(idSucursal, buscar, idCaja), 280);
    return () => window.clearTimeout(t);
  }, [buscar, idSucursal, idCaja, refrescar]);

  const agregar = (p) => {
    if (!sesion) { Swal.fire({ icon: 'warning', title: 'Caja cerrada', text: 'Abre caja para comenzar a vender.' }); return; }
    llavePendiente.current = null;
    setCarrito((lista) => {
      const previo = lista.find((i) => idCarrito(i) === idCarrito(p));
      const cantidadActual = previo?.cantidad || 0;
      if (cantidadActual >= Number(p.stock_actual)) {
        Swal.fire({ icon: 'warning', title: 'Stock insuficiente', text: 'No hay más unidades disponibles de esta prenda.', timer: 1800, showConfirmButton: false });
        return lista;
      }
      return previo ? lista.map((i) => idCarrito(i) === idCarrito(p) ? { ...i, cantidad: i.cantidad + 1 } : i) : [...lista, { ...p, cantidad: 1 }];
    });
  };
  const cambiarCantidad = (idPrenda, cambio) => { llavePendiente.current = null; setCarrito((lista) => lista.map((p) => p.id_prenda === idPrenda ? { ...p, cantidad: Math.min(p.stock_actual, p.cantidad + cambio) } : p).filter((p) => p.cantidad > 0)); };
  const quitar = (idPrenda) => { llavePendiente.current = null; setCarrito((lista) => lista.filter((p) => p.id_prenda !== idPrenda)); };
  const limpiar = () => { llavePendiente.current = null; setCarrito([]); setCarritoMovil(false); };

  const abrirCaja = async () => {
    if (!idSucursal || !idCaja) return;
    setOperandoCaja(true);
    try {
      const { data } = await api.post('/caja/abrir', { id_caja: Number(idCaja), monto_inicial: efectivoInicial });
      setSesion(data.sesion); setModalAbrir(false);
      Swal.fire({ icon: 'success', title: 'Caja abierta', timer: 1200, showConfirmButton: false });
    } catch (e) { Swal.fire('No se pudo abrir', e.response?.data?.mensaje || 'Intenta nuevamente.', 'error'); }
    finally { setOperandoCaja(false); }
  };
  const cerrarCaja = async () => {
    if (!sesion) return;
    const { value } = await Swal.fire({ title: 'Cerrar caja', html: 'Ingresa el efectivo contado físicamente. El sistema calculará la diferencia.', input: 'number', inputAttributes: { min: '0', step: '0.01' }, inputPlaceholder: 'Efectivo contado', showCancelButton: true, confirmButtonText: 'Cerrar caja', confirmButtonColor: '#FC4D84', inputValidator: (v) => !v || Number(v) < 0 ? 'Captura un importe válido' : undefined });
    if (value === undefined) return;
    try {
      const { data } = await api.post('/caja/cerrar', { id_sesion: sesion.id_sesion, efectivo_contado: value });
      setSesion(null); limpiar();
      Swal.fire({ icon: 'success', title: 'Caja cerrada', html: `Efectivo esperado: <b>${peso(data.cierre.efectivo_esperado)}</b><br>Diferencia: <b>${peso(data.cierre.diferencia)}</b>`, confirmButtonColor: '#FC4D84' });
    } catch (e) { Swal.fire('No se pudo cerrar', e.response?.data?.mensaje || 'Intenta nuevamente.', 'error'); }
  };

  const noEfectivo = mixto ? Object.values(pagosMixtos).reduce((acc, v) => acc + centavos(v), 0) : (metodo === 'EFECTIVO' ? 0 : total);
  const requiereEfectivo = Math.max(total - noEfectivo, 0);
  const cash = centavos(recibido);
  const cambio = cash - requiereEfectivo;
  const cobrarValido = vigente && !errorPromocion && total > 0 && sesion && (mixto ? noEfectivo <= total && (requiereEfectivo === 0 || cash >= requiereEfectivo) && (requiereEfectivo > 0 || noEfectivo > 0) : metodo !== 'EFECTIVO' || cash >= total);

  const abrirCobro = () => {
    if (!carrito.length || !sesion || !idCaja || verificandoPromociones || errorPromocion) return;
    setMetodo('EFECTIVO'); setMixto(false); setRecibido(dinero(total));
    setPagosMixtos({ DEBITO: '', CREDITO: '', TRANSFERENCIA: '' });
    setCarritoMovil(false); setCobrarModal(true);
  };

  const cobrar = async () => {
    if (!cobrarValido || cobrando || !vigente) return;
    const pagos = mixto
      ? [
          ...(requiereEfectivo > 0 ? [{ metodo: 'EFECTIVO', monto: dinero(requiereEfectivo) }] : []),
          ...Object.entries(pagosMixtos).filter(([, v]) => centavos(v) > 0).map(([m, v]) => ({ metodo: m, monto: dinero(centavos(v)) })),
        ]
      : [{ metodo, monto: dinero(total) }];
    const confirmacion = await Swal.fire({ icon: 'question', title: '¿Confirmar el cobro?', html: `<p>Prendas: <strong>${cantidadCarrito}</strong></p><p>Total: <strong>${peso(total / 100)}</strong></p>`, showCancelButton: true, confirmButtonText: 'Sí, cobrar', cancelButtonText: 'Volver', confirmButtonColor: '#FC4D84' });
    if (!confirmacion.isConfirmed) return;
    if (!llavePendiente.current) llavePendiente.current = crypto.randomUUID();
    setCobrando(true);
    try {
      const payload = { id_sucursal: Number(idSucursal), id_sesion: sesion.id_sesion, idempotencia: llavePendiente.current,
        items: carrito.map((p) => ({ id_prenda: p.id_prenda, cantidad: p.cantidad })),
        pagos, monto_recibido: (mixto ? requiereEfectivo > 0 : metodo === 'EFECTIVO') ? dinero(cash) : '0.00' };
      const { data } = await api.post('/pos/ventas', payload);
      setTicket(data.venta); setEmail(''); setCobrarModal(false); setCarrito([]);
      setCarritoMovil(false); setSimulacion(null); llavePendiente.current = null;
      await refrescar(idSucursal, buscar, idCaja);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'No se pudo confirmar', text: e.response?.data?.mensaje || 'Comprueba la conexión e intenta de nuevo. No se cobrará dos veces al reintentar.', confirmButtonColor: '#FC4D84' });
      if (e.response?.status === 409) { llavePendiente.current = null; await refrescar(idSucursal, buscar, idCaja); }
    } finally { setCobrando(false); }
  };

  const descargar = async () => {
    if (!ticket || descargando) return;
    setDescargando(true);
    try {
      const { data } = await api.get(`/pos/ventas/${ticket.id_venta}/ticket.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `${ticket.folio}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
    } catch (e) { Swal.fire('Descarga fallida', 'No se pudo descargar el comprobante.', 'error'); }
    finally { setDescargando(false); }
  };

  const enviarEmail = async () => {
    if (!ticket || enviandoEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Swal.fire('Correo inválido', 'Escribe una dirección de correo válida.', 'warning');
    setEnviandoEmail(true);
    try {
      await api.post(`/pos/ventas/${ticket.id_venta}/enviar-ticket`, { correo: email.trim() });
      Swal.fire({ icon: 'success', title: 'Comprobante enviado', text: `Se envió a ${email.trim()}.`, confirmButtonColor: '#FC4D84' });
    } catch (e) { Swal.fire('No se pudo enviar', e.response?.data?.mensaje || 'Comprueba la configuración SMTP.', 'error'); }
    finally { setEnviandoEmail(false); }
  };

  return (
    <div className="ldpos w-full min-w-0 space-y-5 pb-24 lg:pb-5">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[#F0DCE5] bg-gradient-to-br from-[#FFF4F8] via-white to-[#FFF1EA] px-5 py-6 shadow-sm sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[34px] border-[#FC4D84]/[.07]"/>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.22em] text-[#D63E72]"><Sparkles size={15}/> LUDAROPE · Punto de venta</p>
            <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Punto de venta<span className="text-[#FC4D84]">.</span></h1>
            <p className="mt-3 text-sm text-[#927B86]"></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${sesion ? 'bg-[#E9F7EF] text-[#268455]' : 'bg-[#FFF2E7] text-[#B77432]'}`}><span className={`h-2 w-2 rounded-full ${sesion ? 'bg-[#32A268]' : 'bg-[#D39B4E]'}`}/>{sesion ? 'Caja abierta' : 'Caja cerrada'}</div>
            {sesion ? <button type="button" onClick={cerrarCaja} className="rounded-xl border border-[#E9CBD7] bg-white px-4 py-2.5 text-xs font-bold text-[#9D4668] hover:bg-[#FFF0F5]">Cerrar caja</button> : <button type="button" disabled={!idCaja} onClick={() => setModalAbrir(true)} className="rounded-xl bg-[#FC4D84] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#D83E72]">Abrir caja</button>}
          </div>
        </div>
      </section>

      {errorPromocion && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorPromocion} · Actualiza existencias y vuelve a intentar.</div>}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)] xl:grid-cols-[minmax(0,1fr)_minmax(330px,395px)]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-[1.6rem] border border-[#F0DDE5] bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.13em] text-[#806A75]">Sucursal</span>
                <div className="flex items-center gap-2 rounded-xl border border-[#F0DBE2] bg-white px-3 focus-within:border-[#FC4D84]"><Store size={18} className="text-[#FC4D84]"/>
                  <select disabled={!rolAdmin || sucursales.length < 2 || Boolean(sesion)} value={idSucursal} onChange={(e) => setIdSucursal(e.target.value)} className="w-full min-w-0 bg-white py-3 text-sm font-bold text-[#3B2E35] outline-none disabled:opacity-80">
                    {!idSucursal && <option value="">Seleccionar sucursal</option>}
                    {sucursales.map((s) => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}
                  </select><ChevronDown size={14} className="text-[#B49CA6]"/>
                </div>
              </label>
              <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[.13em] text-[#806A75]">Caja física</span>
                <div className="flex items-center gap-2 rounded-xl border border-[#F0DBE2] bg-white px-3 focus-within:border-[#FC4D84]"><Wallet size={18} className="text-[#FC4D84]"/>
                  <select disabled={Boolean(sesion)} value={idCaja} onChange={(e) => setIdCaja(e.target.value)} className="w-full min-w-0 bg-white py-3 text-sm font-bold text-[#3B2E35] outline-none disabled:opacity-80">
                    {!cajas.length && <option value="">Sin caja asignada</option>}
                    {cajas.map(c => <option value={c.id_caja} key={c.id_caja}>{c.nombre}{c.sesion_abierta && !sesion ? ' · en uso' : ''}</option>)}
                  </select><ChevronDown size={14} className="text-[#B49CA6]"/>
                </div>
              </label>
              <div className="flex items-end"><button type="button" onClick={() => refrescar(idSucursal, buscar, idCaja)} disabled={cargando} className="flex h-[47px] w-full items-center justify-center gap-2 rounded-xl border border-[#F0DBE2] bg-[#FFF7FA] px-4 text-sm font-bold text-[#C54270] transition hover:bg-[#FFF0F5] disabled:opacity-50 sm:w-auto">{cargando ? <Loader2 size={17} className="animate-spin"/> : <RefreshCw size={17}/>} Actualizar</button></div>
            </div>
            {!sesion && <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#FFF6EB] px-4 py-3 text-xs font-semibold text-[#AA713E]"><LockKeyhole size={17}/> {idCaja ? 'Abre esta caja para agregar prendas y cobrar.' : 'Solicita al administrador una caja física y abre una sesión para cobrar.'} <a href="/app/caja" className="ml-auto font-bold underline">Ir a Caja</a></div>}
            <div className="mt-4"><label htmlFor="buscar-prenda" className="mb-2 block text-[11px] font-black uppercase tracking-[.13em] text-[#806A75]">Buscar prenda o código de barras</label>
              <div className="flex items-center gap-2 rounded-xl border border-[#F0DBE2] bg-[#FFFDFE] px-4 focus-within:border-[#FC4D84] focus-within:ring-4 focus-within:ring-[#FC4D84]/10"><Search size={19} className="text-[#FC4D84]"/>
                <input ref={searchRef} id="buscar-prenda" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Vestido, talla, LDR o código de barras..." autoComplete="off" className="min-w-0 w-full bg-transparent py-3.5 text-sm text-[#453640] outline-none"/>
                {buscar && <button type="button" onClick={() => setBuscar('')} aria-label="Limpiar búsqueda" className="text-[#BAA2AD]"><X size={17}/></button>}
                <Barcode size={19} className="text-[#BCA6B0]" aria-label="Compatible con lector de código de barras que escribe en el campo"/>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-1"><div><h2 className="font-serif text-2xl font-semibold text-[#352A32]">Prendas disponibles</h2><p className="mt-1 text-xs text-[#9A8390]">Existencias de la sucursal seleccionada</p></div><span className="rounded-full bg-[#FFF0F5] px-3 py-2 text-xs font-bold text-[#C83E6D]">{prendas.length} resultado(s)</span></div>
          {cargando ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-[#FFF0F5]"/>)}</div>
            : prendas.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{prendas.map((p) => <Producto key={p.id_prenda} prenda={p} onAgregar={agregar} disponible={!!sesion}/>)}</div>
              : <div className="rounded-2xl border border-dashed border-[#EAD3DD] bg-white px-5 py-14 text-center"><Package size={34} className="mx-auto text-[#E6B6C5]"/><p className="mt-3 text-sm font-bold text-[#6A5661]">No encontramos prendas disponibles</p><p className="mt-1 text-xs text-[#A58D99]">Prueba otra búsqueda o revisa el inventario de la sucursal.</p></div>}
          <section className="mt-6 rounded-[1.5rem] border border-[#F0DCE5] bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2"><ReceiptText size={19} className="text-[#FC4D84]"/><h2 className="font-serif text-xl font-semibold">Ventas recientes</h2><span className="ml-auto text-[11px] font-semibold text-[#A48C96]">Reenvío y descarga</span></div>
            {!historial.length ? <p className="rounded-xl bg-[#FFF8FB] p-4 text-xs text-[#927B86]">Todavía no hay ventas registradas para mostrar.</p> :
              <div className="divide-y divide-[#F4E5EB]">
                {historial.slice(0, 8).map((v) => (
                  <div key={v.id_venta} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><p className="text-xs font-black text-[#43323A]">{v.folio}</p><p className="mt-1 text-[11px] text-[#9D8692]">{new Date(v.fecha_venta).toLocaleString('es-MX')}</p></div>
                    <div className="flex items-center gap-3"><strong className="text-sm text-[#FC4D84]">{peso(v.total)}</strong><button type="button" onClick={() => { setEmail(''); setTicket(v); }} className="rounded-lg border border-[#EDCEDE] px-3 py-2 text-xs font-bold text-[#BC4470] hover:bg-[#FFF0F5]">Ticket digital</button></div>
                  </div>
                ))}
              </div>}
          </section>
        </div>
        <aside className="hidden self-start lg:sticky lg:top-4 lg:block lg:h-[min(790px,calc(100vh-115px))] lg:min-h-[440px]">
          <Carrito carrito={carrito} total={total} subtotal={subtotal} descuento={descuento} promociones={promociones} verificando={verificandoPromociones} onCantidad={cambiarCantidad} onQuitar={quitar} onLimpiar={limpiar} onCobrar={abrirCobro} disabled={!sesion || verificandoPromociones || !!errorPromocion}/>
        </aside>
      </div>

      <button type="button" onClick={() => setCarritoMovil(true)} className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-[#302730] px-5 py-4 text-white shadow-2xl lg:hidden">
        <span className="flex items-center gap-2 text-sm font-bold"><ShoppingCart size={20}/> Carrito ({cantidadCarrito})</span><span className="text-base font-black">{peso(total / 100)}</span>
      </button>
      {carritoMovil && <div className="fixed inset-0 z-[75] lg:hidden"><button type="button" onClick={() => setCarritoMovil(false)} className="absolute inset-0 bg-[#20141D]/60" aria-label="Cerrar carrito"/><div className="absolute inset-x-0 bottom-0 h-[min(87vh,750px)] rounded-t-[1.75rem] bg-white p-2"><div className="flex justify-end px-2 py-1"><button type="button" onClick={() => setCarritoMovil(false)} aria-label="Cerrar" className="rounded-xl bg-[#FFF0F5] p-2 text-[#C23D6B]"><X size={20}/></button></div><div className="h-[calc(100%-48px)]"><Carrito carrito={carrito} total={total} subtotal={subtotal} descuento={descuento} promociones={promociones} verificando={verificandoPromociones} onCantidad={cambiarCantidad} onQuitar={quitar} onLimpiar={limpiar} onCobrar={abrirCobro} disabled={!sesion || verificandoPromociones || !!errorPromocion}/></div></div></div>}

      {modalAbrir && <div className="ldpos-modal fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#25151E]/60 px-4 py-8"><div className="w-full max-w-md rounded-[1.8rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-widest text-[#FC4D84]">LUDAROPE · Caja</p><h3 className="mt-2 font-serif text-2xl font-semibold">Apertura de caja</h3></div><button type="button" onClick={() => setModalAbrir(false)} className="rounded-xl bg-[#FFF3F7] p-2 text-[#AD6682]"><X size={20}/></button></div><p className="mt-3 text-sm text-[#957C89]">Ingresa el fondo de efectivo para iniciar las ventas.</p><div className="mt-5"><CampoDinero label="Monto inicial" value={efectivoInicial} onChange={setEfectivoInicial}/></div><button type="button" disabled={operandoCaja || centavos(efectivoInicial) < 0} onClick={abrirCaja} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-4 font-bold text-white disabled:opacity-50">{operandoCaja && <Loader2 className="animate-spin" size={18}/>} Abrir caja</button></div></div>}

      {cobrarModal && <div className="ldpos-modal fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#24151E]/65 p-3 sm:p-6"><div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#FC4D84]">Confirmar venta</p><h3 className="mt-2 font-serif text-3xl font-semibold text-[#352932]">Cobrar {peso(total / 100)}</h3><p className="mt-1 text-xs text-[#A08995]">{cantidadCarrito} prenda(s) · Comprobante digital</p></div><button type="button" disabled={cobrando} onClick={() => setCobrarModal(false)} className="rounded-xl bg-[#FFF0F5] p-2 text-[#B54770]"><X size={19}/></button></div>
        <label className="mt-5 flex items-center gap-2 rounded-xl border border-[#F1DFE7] bg-[#FFF9FB] p-3 text-sm font-semibold"><input type="checkbox" checked={mixto} onChange={(e) => { setMixto(e.target.checked); setRecibido(e.target.checked ? '' : dinero(total)); }} className="accent-[#FC4D84]"/> Dividir en varios métodos de pago</label>
        {!mixto ? <><p className="mb-2 mt-5 text-[11px] font-black uppercase tracking-widest text-[#8C7581]">Método de pago</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{METODOS.map(({ id: m, nombre, Icon }) => <button key={m} type="button" onClick={() => { setMetodo(m); setRecibido(m === 'EFECTIVO' ? dinero(total) : ''); }} className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-xs font-bold transition ${metodo === m ? 'border-[#FC4D84] bg-[#FFF0F5] text-[#BF3C6D]' : 'border-[#F0DCE4] bg-white text-[#83707B] hover:border-[#F2B8CD]'}`}><Icon size={21}/>{nombre}</button>)}</div>{metodo === 'EFECTIVO' && <div className="mt-4"><CampoDinero label="Efectivo recibido" value={recibido} onChange={setRecibido}/><p className="mt-3 text-sm font-bold text-[#4A3B42]">Cambio: <span className={cambio >= 0 ? 'text-[#338C65]' : 'text-[#D33C66]'}>{peso(cambio / 100)}</span></p></div>}</>
          : <div className="mt-5 space-y-3"><p className="text-xs font-extrabold uppercase tracking-widest text-[#8C7581]">Distribución del pago</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{['DEBITO','CREDITO','TRANSFERENCIA'].map((m) => <CampoDinero key={m} label={METODOS.find((x) => x.id === m)?.nombre} value={pagosMixtos[m]} onChange={(v) => setPagosMixtos((p) => ({ ...p, [m]: v }))}/>)}</div><div className="rounded-xl bg-[#FFF7FA] p-4"><div className="flex justify-between text-sm text-[#886D79]"><span>Otros pagos</span><strong>{peso(noEfectivo / 100)}</strong></div><div className="mt-2 flex justify-between text-sm text-[#886D79]"><span>Restante en efectivo</span><strong>{peso(requiereEfectivo / 100)}</strong></div></div>{requiereEfectivo > 0 && <CampoDinero label="Efectivo recibido" value={recibido} onChange={setRecibido}/>}<p className="text-xs font-semibold text-[#84707B]">{noEfectivo > total ? 'Los pagos distintos de efectivo exceden el total.' : `Cambio: ${peso(Math.max(cambio, 0) / 100)}`}</p></div>}
        <div className="mt-6 rounded-xl bg-[#F8FBF8] px-4 py-3"><p className="flex items-center gap-2 text-xs text-[#54775C]"><Leaf size={16}/> Sin impresión obligatoria: tu ticket será PDF y correo electrónico.</p></div>
        <button type="button" disabled={!cobrarValido || cobrando} onClick={cobrar} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-4 font-black text-white shadow-[0_12px_25px_rgba(252,77,132,.18)] hover:bg-[#DB366A] disabled:cursor-not-allowed disabled:opacity-50">{cobrando ? <Loader2 size={19} className="animate-spin"/> : <CheckCircle2 size={19}/>} {cobrando ? 'Registrando...' : `Confirmar cobro de ${peso(total / 100)}`}</button>
      </div></div>}

      {ticket && <div className="ldpos-modal fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-[#24151E]/70 p-4"><div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-[1.8rem] bg-white p-6 text-center shadow-2xl sm:p-8"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#E9F8EF] text-[#238C59]"><CheckCircle2 size={36}/></div><h3 className="mt-4 font-serif text-3xl font-semibold text-[#372B35]">¡Venta realizada!</h3><p className="mt-2 text-sm text-[#9C8590]">Folio {ticket.folio}</p><p className="mt-3 text-3xl font-black text-[#FC4D84]">{peso(ticket.total)}</p><div className="mt-5 rounded-2xl bg-[#F5FAF5] px-4 py-4 text-left"><p className="flex items-center gap-2 text-sm font-black text-[#3E7C55]"><Leaf size={18}/> Ticket digital ecológico</p><p className="mt-1 text-xs leading-5 text-[#70917B]">Puedes enviarlo por correo o descargarlo en PDF. Sin papel.</p></div><div className="mt-5 space-y-3 text-left"><label className="block text-[11px] font-extrabold uppercase tracking-wide text-[#9E7788]">Correo del cliente (opcional)</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@correo.com" className="w-full rounded-xl border border-[#EBD7DF] px-4 py-3 text-sm outline-none focus:border-[#FC4D84]"/><button type="button" onClick={enviarEmail} disabled={enviandoEmail || !email.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50">{enviandoEmail ? <Loader2 size={18} className="animate-spin"/> : <Mail size={18}/>} Enviar por correo</button><button type="button" onClick={descargar} disabled={descargando} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#EACBD7] bg-[#FFF7FA] px-4 py-3.5 text-sm font-bold text-[#B73E6A]">{descargando ? <Loader2 size={18} className="animate-spin"/> : <Download size={18}/>} Descargar PDF</button></div><button type="button" onClick={() => { setTicket(null); searchRef.current?.focus(); }} className="mt-5 text-sm font-bold text-[#947D87] hover:text-[#FC4D84]">Finalizar y comenzar otra venta</button></div></div>}
    </div>
  );
}
