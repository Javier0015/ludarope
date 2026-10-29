import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Search, RefreshCw, ReceiptText, Wallet, TrendingUp, CircleX,
  Download, Mail, Eye, Filter, RotateCcw, ChevronLeft, ChevronRight,
  CalendarDays, ShoppingBag, Store, UserRound, CreditCard, Banknote,
  Smartphone, CheckCircle2, X, Loader2, Leaf, FileSpreadsheet, ImageOff, ZoomIn, Ban,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const ROSA = '#FC4D84';
// Mostrar una copia histórica guardada en BD. Para ventas anteriores a la migración
// puede mostrarse la fotografía actual si todavía existe en el catálogo.
const ORIGEN_API = (import.meta.env.VITE_API_URL || '/api').startsWith('http')
  ? new URL(import.meta.env.VITE_API_URL).origin : window.location.origin;
const fotosPrenda = (item) => {
  const historicas = Array.isArray(item?.fotos_snapshot_base64)
    ? item.fotos_snapshot_base64.filter(x => typeof x === 'string' && x.length > 10) : [];
  if (historicas.length) return historicas.slice(0,4).map(f => `data:image/webp;base64,${f}`);
  return (Array.isArray(item?.fotos_actuales) ? item.fotos_actuales : [])
    .filter(ruta => typeof ruta === 'string' && /^\/uploads\/prendas\/[a-zA-Z0-9_-]+\.webp$/.test(ruta))
    .slice(0, 4).map(ruta => `${ORIGEN_API}${ruta}`);
};

function FotoPrendaVendida({ item, alAmpliar }) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [item?.id_detalle, item?.fotos_snapshot_base64, item?.fotos_actuales]);
  const fotos = fotosPrenda(item);
  if (!fotos.length || fallo) return <div className="flex h-[88px] w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#F4DCE5] bg-[#FFF0F5] text-[#C98AA4]">
    <ImageOff size={21}/><span className="text-center text-[9px] font-semibold">Sin foto</span>
  </div>;
  return <button type="button" title="Abrir galería" onClick={() => alAmpliar({ fotos, indice:0, nombre:item.nombre_prenda, historica:item.fotos_snapshot_base64?.length > 0 })}
    className="group relative h-[88px] w-[76px] shrink-0 overflow-hidden rounded-xl border border-[#F2DDE5] bg-[#FFF7FA]">
    <img src={fotos[0]} alt={`Foto de ${item.nombre_prenda}`} onError={() => setFallo(true)} className="h-full w-full object-cover"/>
    {fotos.length > 1 && <span className="absolute bottom-1 right-1 rounded-md bg-[#241D28]/80 px-1.5 py-0.5 text-[10px] font-black text-white">{fotos.length} fotos</span>}
    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100"><ZoomIn size={22}/></span>
  </button>;
}

const estilosInput = 'w-full min-w-0 rounded-2xl border border-[#EFDCE3] bg-white px-4 py-3 text-sm font-semibold text-[#45343E] outline-none transition focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10';
const vacio = { buscar: '', desde: '', hasta: '', id_sucursal: '', id_usuario: '', metodo: '', estado: '' };
const metodos = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'];
const nombresPago = { EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito', TRANSFERENCIA: 'Transferencia' };

const formatoMoneda = (v) => Number(v || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFecha = (f, soloFecha = false) => f ? new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City', dateStyle: 'medium', ...(soloFecha ? {} : { timeStyle: 'short' }),
}).format(new Date(f)) : '—';
const diaLocal = (hace = 0) => {
  const f = new Date(); f.setDate(f.getDate() - hace);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};
const predeterminado = () => ({ ...vacio, desde: diaLocal(29), hasta: diaLocal() });

function Pago({ metodo }) {
  const estilos = {
    EFECTIVO: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    DEBITO: 'bg-[#FFF0F5] text-[#CA3E71] border-[#F9D7E2]',
    CREDITO: 'bg-[#FFF2E9] text-[#C96434] border-[#FFE1CA]',
    TRANSFERENCIA: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${estilos[metodo] || 'border-gray-200 bg-gray-50 text-gray-700'}`}>
    {nombresPago[metodo] || metodo || '—'}
  </span>;
}
function Estado({ estado }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${estado === 'COMPLETADA' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
    {estado === 'COMPLETADA' ? <CheckCircle2 size={12} /> : <CircleX size={12} />}
    {estado === 'COMPLETADA' ? 'Completada' : 'Cancelada'}
  </span>;
}
function Kpi({ icono: Icono, titulo, valor, detalle, tono = 'pink' }) {
  const estilos = {
    pink: 'bg-[#FFF0F5] text-[#FC4D84]', orange: 'bg-[#FFF3EB] text-[#FE714B]',
    green: 'bg-emerald-50 text-emerald-700', dark: 'bg-[#F2EDF0] text-[#675463]',
  };
  return <div className="min-w-0 rounded-[1.6rem] border border-[#F1E0E6] bg-white p-4 shadow-[0_10px_30px_rgba(76,42,62,.045)] sm:p-5">
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${estilos[tono]}`}><Icono size={20}/></div>
    <p className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-[#9D8894]">{titulo}</p>
    <p className="mt-1 break-words text-2xl font-black tracking-tight text-[#342A32] sm:text-[28px]">{valor}</p>
    <p className="mt-1 text-xs text-[#98838F]">{detalle}</p>
  </div>;
}

function Campo({ titulo, children, className = '' }) {
  return <label className={`min-w-0 ${className}`}>
    <span className="mb-1.5 block text-xs font-extrabold text-[#6C5964]">{titulo}</span>
    {children}
  </label>;
}
function Vacante({ mensaje }) {
  return <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center">
    <div className="rounded-[1.2rem] bg-[#FFF0F5] p-4 text-[#FC4D84]"><ReceiptText size={27}/></div>
    <p className="font-extrabold text-[#45343E]">{mensaje}</p>
    <p className="text-sm text-[#94808B]">Intenta modificar los filtros o consultar otro periodo.</p>
  </div>;
}

async function descargarArchivo(path, nombre, mime) {
  const respuesta = await api.get(path, { responseType: 'blob' });
  const blob = new Blob([respuesta.data], { type: mime });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function mensajeError(e, defecto) {
  const contenido = e?.response?.data;
  if (contenido instanceof Blob) {
    try { return JSON.parse(await contenido.text()).mensaje || defecto; } catch { return defecto; }
  }
  return contenido?.mensaje || e?.message || defecto;
}

export default function HistorialVentas() {
  const { usuario } = useAuth();
  const admin = String(usuario?.rol || '').toUpperCase() === 'ADMIN';
  const [filtros, setFiltros] = useState(predeterminado);
  const [aplicados, setAplicados] = useState(predeterminado);
  const [sucursales, setSucursales] = useState([]);
  const [cajeros, setCajeros] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState({ paginas: 0, total: 0 });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [accion, setAccion] = useState('');
  const [refresco, setRefresco] = useState(0);

  const params = useMemo(() => {
    const p = { pagina, limite: 15 };
    Object.entries(aplicados).forEach(([k, v]) => { if (String(v ?? '').trim()) p[k] = String(v).trim(); });
    return p;
  }, [aplicados, pagina]);

  useEffect(() => {
    if (!admin) return;
    let vigente = true;
    api.get('/admin/ventas/filtros').then(({ data }) => {
      if (!vigente) return;
      setSucursales(data.sucursales || []);
      setCajeros(data.cajeros || []);
    }).catch((e) => { if (vigente) console.warn('Filtros de ventas:', e); });
    return () => { vigente = false; };
  }, [admin]);

  const cargarVentas = useCallback(async (cancelado = () => false) => {
    try {
      setCargando(true); setError('');
      const { data } = await api.get('/admin/ventas', { params });
      if (cancelado()) return;
      setVentas(data.ventas || []);
      setResumen(data.resumen || null);
      setPagos(data.pagos || []);
      setPaginacion(data.paginacion || { paginas: 0, total: 0 });
    } catch (e) {
      if (!cancelado()) { setError(e.response?.data?.mensaje || 'No se pudo consultar el historial.'); setVentas([]); }
    } finally { if (!cancelado()) setCargando(false); }
  }, [params]);

  useEffect(() => {
    if (!admin) return;
    let cancelado = false;
    cargarVentas(() => cancelado);
    return () => { cancelado = true; };
  }, [admin, cargarVentas, refresco]);

  useEffect(() => {
    if (!detalle) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alCerrar = (e) => { if (e.key === 'Escape') { setFotoAmpliada(null); setDetalle(null); } };
    window.addEventListener('keydown', alCerrar);
    return () => { document.body.style.overflow = anterior; window.removeEventListener('keydown', alCerrar); };
  }, [detalle]);

  const enviarFiltros = (e) => {
    e.preventDefault();
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      return Swal.fire('Fechas inválidas', 'La fecha inicial no puede ser mayor a la fecha final.', 'warning');
    }
    setPagina(1); setAplicados({ ...filtros });
  };
  const limpiar = () => { const f = predeterminado(); setFiltros(f); setAplicados(f); setPagina(1); };
  const modificar = (k, v) => setFiltros(p => ({ ...p, [k]: v }));

  const abrirDetalle = async (id) => {
    setCargandoDetalle(true);
    try {
      const { data } = await api.get(`/admin/ventas/${id}`);
      setDetalle(data);
    } catch (e) { Swal.fire('Error', await mensajeError(e, 'No se pudo consultar la venta.'), 'error'); }
    finally { setCargandoDetalle(false); }
  };
  const cancelarVenta = async (venta) => {
    if (cancelando || venta?.estado !== 'COMPLETADA') return;
    if (venta.estado_sesion !== 'ABIERTA') {
      return Swal.fire('Caja cerrada', 'La venta pertenece a una caja cerrada. No se modificará un corte anterior; deberá procesarse como devolución en el módulo correspondiente.', 'info');
    }
    const motivo = await Swal.fire({
      title: '¿Por qué cancelar esta venta?',
      text: `Folio: ${venta.folio} · Total: ${formatoMoneda(venta.total)}. Esta acción regresará las prendas al inventario.`,
      icon: 'warning', input: 'textarea', inputLabel: 'Motivo obligatorio (mínimo 10 caracteres)',
      inputPlaceholder: 'Ej. Se capturó la prenda incorrecta y se devolvió el cobro al cliente.',
      inputAttributes: { maxLength: '500' },
      showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Volver', confirmButtonColor: ROSA,
      inputValidator: (v) => String(v || '').trim().length < 10 ? 'Escribe un motivo de al menos 10 caracteres.' : undefined,
    });
    if (!motivo.isConfirmed) return;
    const confirmacion = await Swal.fire({
      icon: 'warning', title: 'Confirmar devolución del dinero',
      text: 'El POS NO devuelve dinero a tarjetas o bancos. Debes efectuar el reembolso por fuera del sistema antes de confirmar. Se anulará el cobro en el corte de esta sesión abierta.',
      input: 'checkbox',
      inputPlaceholder: 'Confirmo que el efectivo fue devuelto y/o que los reembolsos electrónicos fueron gestionados.',
      inputValue: 0, showCancelButton: true, confirmButtonText: 'Cancelar venta definitivamente',
      cancelButtonText: 'No cancelar', confirmButtonColor: '#B42342',
      inputValidator: (valor) => String(valor) === '1' ? undefined : 'Confirma la devolución antes de cancelar.',
    });
    if (!confirmacion.isConfirmed) return;
    try {
      setCancelando(true);
      const { data } = await api.post(`/admin/ventas/${venta.id_venta}/cancelar`, {
        motivo: String(motivo.value).trim(), confirmar_devolucion: true,
      });
      const actualizado = await api.get(`/admin/ventas/${venta.id_venta}`);
      setDetalle(actualizado.data);
      setRefresco((v) => v + 1);
      await Swal.fire({ icon: 'success', title: 'Venta cancelada',
        text: data.mensaje || 'El inventario fue restaurado y se registró la cancelación.',
        confirmButtonColor: ROSA });
    } catch (e) {
      Swal.fire('No fue posible cancelar', await mensajeError(e, 'No se modificó la venta.'), 'error');
    } finally { setCancelando(false); }
  };

  const descargarPdf = async (venta) => {
    if (venta.estado !== 'COMPLETADA') return Swal.fire('Comprobante no disponible', 'Los tickets de ventas canceladas no se descargan como comprobantes vigentes.', 'info');
    if (descargando) return;
    try {
      setDescargando(true); setAccion(`pdf-${venta.id_venta}`);
      await descargarArchivo(`/pos/ventas/${venta.id_venta}/ticket.pdf`, `${venta.folio}.pdf`, 'application/pdf');
    } catch (e) { Swal.fire('No se pudo descargar', await mensajeError(e, 'Revisa la conexión e intenta nuevamente.'), 'error'); }
    finally { setDescargando(false); setAccion(''); }
  };
  const enviarCorreo = async (venta) => {
    if (venta.estado !== 'COMPLETADA') return Swal.fire('Envío no disponible', 'No se envían comprobantes de ventas canceladas.', 'info');
    const r = await Swal.fire({
      title: 'Enviar ticket digital',
      text: `Comprobante ${venta.folio}`,
      input: 'email',
      inputLabel: 'Correo electrónico del cliente',
      inputPlaceholder: 'cliente@correo.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar correo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: ROSA,
      inputValidator: (valor) => (!valor || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) ? 'Escribe un correo válido.' : undefined,
    });
    if (!r.isConfirmed) return;
    try {
      setAccion(`email-${venta.id_venta}`);
      const { data } = await api.post(`/pos/ventas/${venta.id_venta}/enviar-ticket`, { correo: r.value.trim() });
      await Swal.fire({ icon: 'success', title: 'Comprobante enviado', text: data.mensaje, confirmButtonColor: ROSA });
      if (String(detalle?.venta?.id_venta) === String(venta.id_venta)) {
        const actualizado = await api.get(`/admin/ventas/${venta.id_venta}`);
        setDetalle(actualizado.data);
      }
    } catch (e) { Swal.fire('No se pudo enviar', await mensajeError(e, 'La venta permanece registrada. Comprueba SMTP o reintenta.'), 'error'); }
    finally { setAccion(''); }
  };
  const exportar = async () => {
    try {
      setDescargando(true); setAccion('csv');
      const p = new URLSearchParams();
      Object.entries(aplicados).forEach(([k, v]) => { if (String(v ?? '').trim()) p.set(k, String(v).trim()); });
      await descargarArchivo(`/admin/ventas/exportar.csv?${p.toString()}`, 'LUDAROPE_Historial_Ventas.csv', 'text/csv;charset=utf-8');
    } catch (e) { Swal.fire('No se pudo exportar', await mensajeError(e, 'Intenta acortar el periodo.'), 'error'); }
    finally { setDescargando(false); setAccion(''); }
  };

  if (!admin) return <div className="rounded-2xl border border-red-100 bg-white p-8 text-center font-bold text-rose-700">Este módulo es exclusivo para ADMIN.</div>;

  return <div className="min-w-0 space-y-5 pb-10 sm:space-y-6">
    <style>{`.swal2-container { z-index: 10050 !important; }`}</style>
    <section className="relative overflow-hidden rounded-[2rem] border border-[#F2DDE5] bg-white p-5 shadow-[0_14px_45px_rgba(83,42,64,.045)] sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-[#FFF0F5]"/>
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#FC4D84]">LUDAROPE / Administración</p>
            <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Historial de ventas<span className="text-[#FC4D84]">.</span></h1>
            <p className="mt-1 text-sm text-[#917D88]">Consulta ventas, formas de pago y comprobantes digitales por sucursal.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={cargando} onClick={() => setRefresco(n => n + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#EECFD9] bg-white px-4 py-3 text-xs font-extrabold text-[#BB4470] transition hover:bg-[#FFF3F7] disabled:opacity-50"><RefreshCw size={16} className={cargando ? 'animate-spin' : ''}/> Actualizar</button>
          <button type="button" disabled={descargando} onClick={exportar} className="inline-flex items-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 text-xs font-extrabold text-white shadow-[0_9px_20px_rgba(252,77,132,.16)] transition hover:bg-[#E53974] disabled:opacity-50">{accion === 'csv' ? <Loader2 size={16} className="animate-spin"/> : <FileSpreadsheet size={16}/>} Exportar CSV</button>
        </div>
      </div>
    </section>

    <form onSubmit={enviarFiltros} className="rounded-[1.8rem] border border-[#F1DDE5] bg-[#FFF9FB] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2"><Filter size={18} className="text-[#FC4D84]"/><h2 className="font-extrabold text-[#493640]">Filtros de búsqueda</h2></div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Campo titulo="Folio, prenda o cajero" className="xl:col-span-2"><div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BDA4AF]"/><input value={filtros.buscar} onChange={e => modificar('buscar',e.target.value)} placeholder="LUD-00000001, nombre o código LDR..." className={`${estilosInput} pl-11`}/></div></Campo>
        <Campo titulo="Desde"><input type="date" className={estilosInput} value={filtros.desde} onChange={e => modificar('desde',e.target.value)}/></Campo>
        <Campo titulo="Hasta"><input type="date" className={estilosInput} value={filtros.hasta} onChange={e => modificar('hasta',e.target.value)}/></Campo>
        <Campo titulo="Sucursal"><select className={estilosInput} value={filtros.id_sucursal} onChange={e => modificar('id_sucursal',e.target.value)}><option value="">Todas las sucursales</option>{sucursales.map(s => <option value={s.id_sucursal} key={s.id_sucursal}>{s.nombre}{s.activa ? '' : ' (inactiva)'}</option>)}</select></Campo>
        <Campo titulo="Cajero"><select className={estilosInput} value={filtros.id_usuario} onChange={e => modificar('id_usuario',e.target.value)}><option value="">Todos los cajeros</option>{cajeros.map(c => <option value={c.id_usuario} key={c.id_usuario}>{c.nombre}</option>)}</select></Campo>
        <Campo titulo="Método de pago"><select className={estilosInput} value={filtros.metodo} onChange={e => modificar('metodo',e.target.value)}><option value="">Todos los métodos</option>{metodos.map(m => <option key={m} value={m}>{nombresPago[m]}</option>)}</select></Campo>
        <Campo titulo="Estado"><select className={estilosInput} value={filtros.estado} onChange={e => modificar('estado',e.target.value)}><option value="">Todos los estados</option><option value="COMPLETADA">Completadas</option><option value="CANCELADA">Canceladas</option></select></Campo>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={limpiar} className="inline-flex items-center gap-2 rounded-xl border border-[#F1DCE3] bg-white px-4 py-3 text-xs font-extrabold text-[#8B6F7A]"><RotateCcw size={15}/> Restablecer</button>
        <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#352B33] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-[#55414E]"><Search size={15}/> Buscar ventas</button>
      </div>
    </form>

    {error && <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kpi icono={ReceiptText} titulo="Ventas completadas" valor={resumen?.completadas ?? '—'} detalle="Operaciones cobradas"/>
      <Kpi icono={TrendingUp} titulo="Total vendido" valor={resumen ? formatoMoneda(resumen.total_vendido) : '—'} detalle="Sin ventas canceladas" tono="green"/>
      <Kpi icono={Wallet} titulo="Ticket promedio" valor={resumen ? formatoMoneda(resumen.ticket_promedio) : '—'} detalle="Por venta completada" tono="orange"/>
      <Kpi icono={CircleX} titulo="Canceladas" valor={resumen?.canceladas ?? '—'} detalle="No suman al ingreso" tono="dark"/>
    </section>

    <section className="overflow-hidden rounded-[1.8rem] border border-[#F0DFE6] bg-white shadow-[0_14px_45px_rgba(83,42,64,.045)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1E4E9] px-5 py-5 sm:px-6">
        <div><h2 className="text-lg font-black text-[#382A33]">Ventas registradas</h2><p className="mt-1 text-xs text-[#9B8791]">{paginacion.total} resultado(s) en el periodo seleccionado</p></div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF0F5] px-3 py-2 text-xs font-extrabold text-[#CF3F72]"><CalendarDays size={14}/> Horario Ciudad de México</div>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-[#FFFAFB] text-[10px] font-extrabold uppercase tracking-wider text-[#96828C]"><tr>
            {['Folio / fecha','Sucursal / caja','Cajero','Prendas','Pagos','Total','Estado','Acciones'].map(t => <th key={t} className="px-4 py-4">{t}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[#F5EAEF]">
            {cargando ? <tr><td colSpan={8} className="px-5 py-14 text-center text-[#987F8C]"><Loader2 className="mr-2 inline animate-spin" size={18}/> Cargando ventas...</td></tr> :
              ventas.length === 0 ? <tr><td colSpan={8}><Vacante mensaje="No hay ventas para estos filtros"/></td></tr> : ventas.map(v => <tr key={v.id_venta} className="transition hover:bg-[#FFFBFC]">
                <td className="px-4 py-4"><p className="font-extrabold text-[#40323C]">{v.folio}</p><p className="mt-1 whitespace-nowrap text-xs text-[#9B8791]">{formatoFecha(v.fecha_venta)}</p></td>
                <td className="px-4 py-4"><p className="max-w-[210px] font-semibold text-[#59434F]">{v.sucursal}</p><p className="mt-1 text-xs text-[#A08B96]">{v.caja || 'Sin caja asignada'}</p></td>
                <td className="px-4 py-4 text-[#75636D]">{v.cajero}</td>
                <td className="px-4 py-4 font-bold text-[#58434E]">{v.piezas}</td>
                <td className="px-4 py-4"><div className="flex max-w-[160px] flex-wrap gap-1">{String(v.metodos || '').split(', ').map(m => <Pago metodo={m} key={`${v.id_venta}-${m}`}/>)}</div></td>
                <td className="px-4 py-4 font-black text-[#352832]">{formatoMoneda(v.total)}</td>
                <td className="px-4 py-4"><Estado estado={v.estado}/></td>
                <td className="px-4 py-4"><button type="button" onClick={() => abrirDetalle(v.id_venta)} disabled={cargandoDetalle} className="inline-flex items-center gap-2 rounded-xl border border-[#F2D7E1] bg-[#FFF5F8] px-3 py-2 text-xs font-black text-[#CB3F72] hover:bg-[#FFEAF2]"><Eye size={15}/> Ver detalle</button></td>
              </tr>)}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-4 lg:hidden">
        {cargando ? <div className="py-10 text-center text-sm text-[#9B8490]">Cargando ventas...</div> : ventas.length === 0 ? <Vacante mensaje="No hay ventas para estos filtros"/> : ventas.map(v => <article key={v.id_venta} className="rounded-2xl border border-[#F3E1E7] bg-[#FFFCFD] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold text-[#43313E]">{v.folio}</p><p className="mt-1 text-xs text-[#9B8490]">{formatoFecha(v.fecha_venta)}</p></div><Estado estado={v.estado}/></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[10px] font-bold uppercase text-[#9C8791]">Sucursal</p><p className="mt-1 text-xs font-semibold text-[#604C57]">{v.sucursal}</p></div><div><p className="text-[10px] font-bold uppercase text-[#9C8791]">Cajero</p><p className="mt-1 text-xs font-semibold text-[#604C57]">{v.cajero}</p></div></div>
          <div className="mt-4 flex items-center justify-between border-t border-[#F1E5E9] pt-3"><div><p className="text-[10px] font-extrabold uppercase text-[#A08A94]">Total</p><p className="text-xl font-black text-[#362B33]">{formatoMoneda(v.total)}</p></div><button onClick={() => abrirDetalle(v.id_venta)} className="inline-flex items-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 text-xs font-black text-white"><Eye size={16}/> Detalle</button></div>
        </article>)}
      </div>
      {paginacion.paginas > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F2E5E9] px-4 py-4 sm:px-6">
        <p className="text-xs font-semibold text-[#8F7A85]">Página {pagina} de {paginacion.paginas} · {paginacion.total} ventas</p>
        <div className="flex gap-2"><button type="button" disabled={pagina <= 1 || cargando} onClick={() => setPagina(p => p - 1)} className="rounded-xl border border-[#F2DAE2] px-3 py-2 text-[#FC4D84] disabled:opacity-35" aria-label="Página anterior"><ChevronLeft size={19}/></button><button type="button" disabled={pagina >= paginacion.paginas || cargando} onClick={() => setPagina(p => p + 1)} className="rounded-xl border border-[#F2DAE2] px-3 py-2 text-[#FC4D84] disabled:opacity-35" aria-label="Página siguiente"><ChevronRight size={19}/></button></div>
      </div>}
    </section>

    <section className="rounded-[1.8rem] border border-[#F1DDE5] bg-white p-4 sm:p-6">
      <div className="flex items-center gap-2"><CreditCard size={20} className="text-[#FC4D84]"/><h2 className="font-black text-[#3E2F38]">Ventas por método de pago</h2></div>
      <p className="mt-1 text-xs text-[#A08A93]">Desglose de los pagos recibidos en las ventas completadas del filtro. En pagos mixtos cada importe se contabiliza por separado.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metodos.map(m => {
          const r = pagos.find(p => p.metodo === m);
          const I = m === 'EFECTIVO' ? Banknote : m === 'TRANSFERENCIA' ? Smartphone : CreditCard;
          return <div key={m} className="rounded-2xl border border-[#F3E5E9] bg-[#FFF9FB] px-4 py-4">
            <div className="flex items-center gap-2"><I size={17} className="text-[#FC4D84]"/><span className="text-xs font-extrabold text-[#816D78]">{nombresPago[m]}</span></div>
            <p className="mt-2 text-xl font-black text-[#3C2D35]">{formatoMoneda(r?.total)}</p>
            <p className="mt-1 text-xs text-[#99848F]">{r?.ventas || 0} venta(s)</p>
          </div>;
        })}
      </div>
    </section>

    {detalle && <div role="presentation" className="fixed inset-0 z-[9999] flex justify-end bg-[#241D28]/65 p-0 backdrop-blur-sm sm:p-4">
      <button type="button" onClick={() => setDetalle(null)} aria-label="Cerrar detalle" className="absolute inset-0 h-full w-full cursor-default" />
      <section role="dialog" aria-modal="true" aria-label={`Detalle de venta ${detalle.venta.folio}`} className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-[1.8rem]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#F2E2E8] bg-[#FFF8FA] px-5 py-5 sm:px-6">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-[#FC4D84]">Detalle de venta</p><h2 className="mt-1 text-xl font-black text-[#382B33] sm:text-2xl">{detalle.venta.folio}</h2><p className="mt-1 text-xs text-[#9A828E]">{formatoFecha(detalle.venta.fecha_venta)}</p></div>
          <button type="button" onClick={() => setDetalle(null)} className="rounded-xl bg-white p-2.5 text-[#8D6D7C] hover:bg-[#FFEAF1]" aria-label="Cerrar"><X size={20}/></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><Estado estado={detalle.venta.estado}/><span className="text-2xl font-black text-[#332831]">{formatoMoneda(detalle.venta.total)}</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#FFF9FB] p-4"><p className="flex items-center gap-2 text-xs font-black text-[#A18B94]"><Store size={15}/> Sucursal</p><p className="mt-2 text-sm font-bold text-[#54404B]">{detalle.venta.nombre_sucursal}</p><p className="mt-1 text-xs text-[#947F89]">{detalle.venta.direccion_sucursal || 'Sin dirección'}</p></div>
            <div className="rounded-2xl bg-[#FFF9FB] p-4"><p className="flex items-center gap-2 text-xs font-black text-[#A18B94]"><UserRound size={15}/> Atendió</p><p className="mt-2 text-sm font-bold text-[#54404B]">{detalle.venta.nombre_cajero}</p><p className="mt-1 text-xs text-[#947F89]">{detalle.venta.nombre_caja || 'Caja sin asignar'}</p></div>
          </div>
          <div><div className="mb-3 flex items-center gap-2"><ShoppingBag size={18} className="text-[#FC4D84]"/><h3 className="font-black text-[#49343E]">Prendas vendidas</h3></div>
            <div className="overflow-hidden rounded-2xl border border-[#F1E1E6] divide-y divide-[#F3E8EC]">
              {detalle.detalles.map(d => <div key={d.id_detalle} className="flex items-start gap-3 p-4">
                  <FotoPrendaVendida item={d} alAmpliar={setFotoAmpliada}/>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold text-[#43323D]">{d.nombre_prenda}</p>
                    <p className="mt-1 text-xs text-[#967F8A]">{d.codigo} · {[d.talla,d.color].filter(Boolean).join(' · ')}</p>
                    <p className="mt-1 text-xs text-[#967F8A]">{d.cantidad} × {formatoMoneda(d.precio_unitario)}</p>
                  {Number(d.descuento)>0 && <p className="mt-1 text-xs font-bold text-emerald-700">Descuento: -{formatoMoneda(d.descuento)}</p>}
                  {(d.promociones_snapshot||[]).map((pr,i)=><p key={i} className="mt-1 text-xs font-semibold text-[#C43E70]">✦ {pr.nombre}</p>)}
                    {fotosPrenda(d).length > 0 && <p className="mt-1 text-[10px] font-semibold text-[#B48C9D]">{d.fotos_snapshot_base64?.length ? `Galería histórica · ${fotosPrenda(d).length} foto(s)` : `Galería actual · ${fotosPrenda(d).length} foto(s)`}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-black text-[#3C2B35]">{formatoMoneda(d.total_linea)}</p>
                </div>)}
            </div>
          </div>
          <div className="space-y-2 rounded-2xl bg-[#FFF9FB] p-4">
            <div className="flex justify-between text-sm text-[#77636F]"><span>Subtotal</span><span>{formatoMoneda(detalle.venta.subtotal)}</span></div>
            <div className="flex justify-between text-sm text-[#77636F]"><span>Descuentos</span><span>-{formatoMoneda(detalle.venta.descuento_total)}</span></div>
            <div className="flex justify-between border-t border-[#EEDBE2] pt-3 font-black text-[#45313B]"><span>Total</span><span className="text-xl text-[#FC4D84]">{formatoMoneda(detalle.venta.total)}</span></div>
          </div>
          <div><h3 className="mb-3 font-black text-[#47323E]">Formas de pago</h3><div className="space-y-2">{detalle.pagos.map((p,i) => <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0E0E7] px-3 py-3"><Pago metodo={p.metodo}/><div className="text-right"><p className="text-sm font-black text-[#493640]">{formatoMoneda(p.monto)}</p>{p.referencia && <p className="mt-1 max-w-[180px] break-words text-xs text-[#94808B]">Ref. {p.referencia}</p>}</div></div>)}</div>
            {Number(detalle.venta.cambio) > 0 && <p className="mt-2 text-right text-xs font-bold text-[#917E88]">Cambio entregado: {formatoMoneda(detalle.venta.cambio)}</p>}
          </div>
          {detalle.venta.estado === 'CANCELADA' && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-black">Venta cancelada</p>
              <p className="mt-1">{detalle.venta.motivo_cancelacion || 'Sin motivo registrado'}</p>
              <p className="mt-1 text-xs">{detalle.cancelacion?.cancelada_por || detalle.venta.nombre_usuario_cancelo || 'Administrador'} · {formatoFecha(detalle.venta.fecha_cancelacion)}</p>
            </div>}
            {detalle.venta.estado === 'COMPLETADA' && detalle.venta.estado_sesion !== 'ABIERTA' && <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-semibold text-amber-900">Esta venta pertenece a una caja cerrada. Para no alterar cortes conciliados, su cancelación está bloqueada; requiere un proceso de devolución separado.</div>}
          <div className="rounded-2xl border border-[#F0E4E8] p-4"><h3 className="font-black text-[#48343E]">Comprobante digital</h3><p className="mt-1 text-xs text-[#947F8A]">Solo correo electrónico o descarga PDF. No genera CFDI.</p><p className="mt-2 text-xs text-[#A18B95]">Intentos recientes: {detalle.envios.length} · Enviados: {detalle.envios.filter(e => e.estado === 'ENVIADO').length}</p></div>
        </div>
        {detalle.venta.estado === 'CANCELADA' && <p className="border-t border-[#F2E4E9] px-5 py-3 text-xs font-semibold text-rose-700">Esta venta está cancelada: no se puede emitir ni reenviar un comprobante de compra vigente.</p>}
      <div className="flex shrink-0 flex-col gap-2 border-t border-[#F2E4E9] bg-white p-4 sm:flex-row sm:p-5">
          <button type="button" disabled={descargando || detalle.venta.estado !== 'COMPLETADA'} onClick={() => descargarPdf(detalle.venta)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#EFC8D5] bg-[#FFF6F9] px-4 py-3 text-sm font-black text-[#C84373] disabled:opacity-50">{accion === `pdf-${detalle.venta.id_venta}` ? <Loader2 className="animate-spin" size={17}/> : <Download size={17}/>} Descargar PDF</button>
          <button type="button" disabled={Boolean(accion) || detalle.venta.estado !== 'COMPLETADA'} onClick={() => enviarCorreo(detalle.venta)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{accion === `email-${detalle.venta.id_venta}` ? <Loader2 size={17} className="animate-spin"/> : <Mail size={17}/>} Enviar por correo</button>
          {detalle.venta.estado === 'COMPLETADA' && detalle.venta.estado_sesion === 'ABIERTA' && <button type="button"
            disabled={cancelando || Boolean(accion)} onClick={() => cancelarVenta(detalle.venta)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
            {cancelando ? <Loader2 size={17} className="animate-spin"/> : <Ban size={17}/>} Cancelar venta
          </button>}
        </div>
      </section>

      </div>}

      {fotoAmpliada && <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-[#241D28]/90 p-5" role="dialog" aria-modal="true" aria-label="Foto de la prenda vendida">
        <button type="button" className="absolute inset-0" onClick={() => setFotoAmpliada(null)} aria-label="Cerrar fotografía"/>
        <div className="relative max-h-[92vh] max-w-3xl text-center">
          <button type="button" onClick={() => setFotoAmpliada(null)} className="absolute -right-3 -top-3 rounded-full bg-white p-2 text-[#FC4D84] shadow-lg" aria-label="Cerrar"><X size={20}/></button>
          <div className="flex items-center gap-2">
            {fotoAmpliada.fotos.length > 1 && <button type="button" onClick={() => setFotoAmpliada(g => ({...g,indice:(g.indice-1+g.fotos.length)%g.fotos.length}))}
              aria-label="Foto anterior" className="rounded-full bg-white p-2 text-[#FC4D84]"><ChevronLeft size={24}/></button>}
            <img src={fotoAmpliada.fotos[fotoAmpliada.indice]} alt={`${fotoAmpliada.nombre} - foto ${fotoAmpliada.indice+1}`}
              className="max-h-[76vh] max-w-[min(75vw,700px)] rounded-2xl object-contain"/>
            {fotoAmpliada.fotos.length > 1 && <button type="button" onClick={() => setFotoAmpliada(g => ({...g,indice:(g.indice+1)%g.fotos.length}))}
              aria-label="Foto siguiente" className="rounded-full bg-white p-2 text-[#FC4D84]"><ChevronRight size={24}/></button>}
          </div>
          <p className="mt-3 text-sm font-bold text-white">{fotoAmpliada.nombre} · {fotoAmpliada.indice+1} de {fotoAmpliada.fotos.length}</p>
          <p className="mt-1 text-xs text-white/70">{fotoAmpliada.historica ? 'Fotografía histórica de la venta' : 'Fotografía actual de la prenda'}</p>
        </div>
      </div>}

    </div>;
}
