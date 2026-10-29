import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, CalendarRange, ChartColumnIncreasing, CircleAlert,
  CreditCard, Download, Package, ReceiptText, RefreshCw,
  ShoppingBag, ShoppingCart, Store, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// Colores oficiales LUDAROPE
const C = {
  blanco: '#FEFEFE', rosa: '#FC4D84', coral: '#FE714B',
  naranja: '#FF751F', dorado: '#E7AA44', tinta: '#352A30',
  texto: '#78636C', borde: '#F2E3E8', fondo: '#FFF9F9',
};
const COLORES = [C.rosa, C.coral, C.naranja, C.dorado];
const tarjeta = 'relative min-w-0 overflow-hidden rounded-[1.75rem] border border-[#F2E3E8] bg-white p-5 shadow-[0_10px_34px_rgba(86,49,61,0.045)] sm:p-6';
const campo = 'block min-w-0 max-w-full w-full rounded-2xl border border-[#EEDDE4] bg-[#FFFDFD] px-4 py-3 text-sm font-semibold text-[#51424A] outline-none transition focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10';

const numero = (n) => n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX');
const moneda = (n) => n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const porcentaje = (n) => n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}%`;
const fechaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inicioMes = () => {
  const d = new Date();
  return fechaLocal(new Date(d.getFullYear(), d.getMonth(), 1));
};
const hoy = () => fechaLocal(new Date());
const fechaHora = (f) => f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// Respuesta esperada del futuro backend. Los valores nulos significan
// "aún no disponible", y NO se presentan como ventas en cero.
const VACIO = {
  resumen: {
    total_vendido: null, utilidad_bruta: null, descuentos_aplicados: null, prendas_vendidas: null,
    total_ventas: null, ticket_promedio: null, prendas_disponibles: null,
    valor_inventario: null,
  },
  ventas_diarias: [], categorias_mas_vendidas: [], pagos_por_metodo: [],
  ventas_por_sucursal: [], ultimas_ventas: [], prendas_sin_movimiento: [],
  detalle_utilidad: [],
};

function SinDatos({ texto = 'Aún no hay información para este periodo.' }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-[1.35rem] bg-[#FFF9FA] p-5 text-center">
      <ChartColumnIncreasing size={28} className="mb-3 text-[#E7AA44]" />
      <p className="max-w-xs text-sm font-semibold text-[#89747E]">{texto}</p>
    </div>
  );
}

function BloqueTitulo({ etiqueta, titulo, descripcion, Icon }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#FC4D84]">{etiqueta}</p>
        <h2 className="mt-1 text-lg font-black text-[#352A30]">{titulo}</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#907C85]">{descripcion}</p>
      </div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F5] text-[#FC4D84]">
        <Icon size={21} />
      </span>
    </div>
  );
}

function Modal({ titulo, descripcion, alCerrar, children }) {
  useEffect(() => {
    const tecla = (event) => event.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alCerrar]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#352A30]/45 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="flex max-h-[91vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#F2E3E8] bg-[#FFF9FA] p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-black text-[#352A30]">{titulo}</h2>
            <p className="mt-1 text-sm text-[#89747E]">{descripcion}</p>
          </div>
          <button aria-label="Cerrar" onClick={alCerrar} className="rounded-xl bg-[#FFF0F5] p-2 text-[#FC4D84] hover:bg-[#FFE1EB]"><X size={20} /></button>
        </div>
        <div className="overflow-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function TablaDetalle({ tipo, filas, exportar }) {
  const utilidad = tipo === 'utilidad';
  const cabeceras = utilidad
    ? ['Prenda', 'Categoría', 'Sucursal', 'Unidades', 'Costo', 'Venta', 'Utilidad', 'Margen']
    : ['Prenda', 'Categoría', 'Sucursal', 'Días sin venta', 'Costo invertido'];
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#78636C]">{filas.length} registro(s)</p>
        <button type="button" disabled={!filas.length} onClick={exportar} className="flex items-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E83B72] disabled:opacity-40"><Download size={16} /> Exportar CSV</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#F2E3E8]">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-[#FFF4F6] text-[11px] uppercase tracking-wide text-[#806B74]">
            <tr>{cabeceras.map((h) => <th className="whitespace-nowrap px-4 py-3" key={h}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#F5E9EC]">
            {!filas.length ? <tr><td className="px-4 py-10 text-center text-[#907C85]" colSpan={cabeceras.length}>Sin registros disponibles.</td></tr>
              : filas.map((r, index) => (
                <tr key={r.id_detalle ?? r.id_prenda ?? index} className="hover:bg-[#FFF9FA]">
                  <td className="px-4 py-3 font-bold text-[#352A30]">{r.prenda}</td>
                  <td className="px-4 py-3">{r.categoria || '—'}</td>
                  <td className="px-4 py-3">{r.sucursal || '—'}</td>
                  {utilidad ? <>
                    <td className="px-4 py-3 text-right">{numero(r.cantidad)}</td>
                    <td className="px-4 py-3 text-right">{moneda(r.costo)}</td>
                    <td className="px-4 py-3 text-right">{moneda(r.venta)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#FC4D84]">{moneda(r.utilidad)}</td>
                    <td className="px-4 py-3 text-right">{porcentaje(r.margen)}</td>
                  </> : <>
                    <td className="px-4 py-3 text-right">{numero(r.dias)}</td>
                    <td className="px-4 py-3 text-right">{moneda(r.costo)}</td>
                  </>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function exportarCsv(nombreArchivo, cabeceras, registros) {
  const celda = (valor) => {
    let v = String(valor ?? '');
    if (/^[\s]*[=+@-]/.test(v)) v = `'${v}`; // Mitigar fórmula al abrir CSV en Excel
    return `"${v.replaceAll('"', '""')}"`;
  };
  const texto = '\uFEFF' + [cabeceras, ...registros].map((r) => r.map(celda).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [sucursales, setSucursales] = useState([]);
  const [sucursal, setSucursal] = useState('todas');
  const [fechaInicio, setFechaInicio] = useState(inicioMes);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [filtrosAplicados, setFiltrosAplicados] = useState({ sucursal: 'todas', fechaInicio: inicioMes(), fechaFin: hoy() });
  const [datos, setDatos] = useState(VACIO);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modal, setModal] = useState(null);

  const esAdmin = usuario?.rol === 'ADMIN';

  useEffect(() => {
    if (!esAdmin) return;
    let vigente = true;
    api.get('/sucursales').then(({ data }) => {
      if (vigente) setSucursales((data.sucursales || []).filter((s) => s.activa === true || s.activo === true));
    }).catch(() => {
      if (vigente) setError('No fue posible cargar las sucursales. Verifica que las rutas del backend estén registradas.');
    });
    return () => { vigente = false; };
  }, [esAdmin]);

  const cargarDashboard = useCallback(async (signal) => {
    if (!esAdmin) return;
    setCargando(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard/resumen', {
        params: {
          sucursal: filtrosAplicados.sucursal,
          fecha_inicio: filtrosAplicados.fechaInicio,
          fecha_fin: filtrosAplicados.fechaFin,
        },
        signal,
      });
      if (!data.ok) throw new Error(data.mensaje || 'No fue posible cargar el dashboard');
      setDatos({ ...VACIO, ...data, resumen: { ...VACIO.resumen, ...data.resumen } });
      setAviso(data.mensaje || '');
    } catch (e) {
      if (e.code === 'ERR_CANCELED') return;
      setDatos(VACIO);
      setAviso('');
      setError(e.response?.data?.mensaje || e.message || 'Error al consultar el dashboard.');
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [esAdmin, filtrosAplicados]);

  useEffect(() => {
    const controlador = new AbortController();
    cargarDashboard(controlador.signal);
    return () => controlador.abort();
  }, [cargarDashboard]);

  const aplicarFiltros = (e) => {
    e.preventDefault();
    if (fechaInicio > fechaFin) {
      setError('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    setFiltrosAplicados({ sucursal, fechaInicio, fechaFin });
    setError('');
    // Si los filtros no cambiaron, también se puede actualizar manualmente:
    if (sucursal === filtrosAplicados.sucursal && fechaInicio === filtrosAplicados.fechaInicio && fechaFin === filtrosAplicados.fechaFin) {
      cargarDashboard();
    }
  };

  const d = datos;
  const r = d.resumen || VACIO.resumen;
  const nombreSucursal = filtrosAplicados.sucursal === 'todas'
    ? 'Todas las sucursales'
    : sucursales.find((s) => String(s.id_sucursal) === String(filtrosAplicados.sucursal))?.nombre || 'Sucursal seleccionada';

  const tarjetas = [
    { titulo: 'Descuentos otorgados', valor: moneda(r.descuentos_aplicados), extra: 'Ahorro de clientes en el periodo', icono: ReceiptText, color: C.rosa },
    { titulo: 'Total vendido', valor: moneda(r.total_vendido), extra: `${numero(r.total_ventas)} venta(s)`, icono: ShoppingCart, color: C.rosa },
    { titulo: 'Utilidad bruta', valor: moneda(r.utilidad_bruta), extra: 'Antes de gastos operativos', icono: TrendingUp, color: C.coral, accion: 'utilidad' },
    { titulo: 'Prendas vendidas', valor: numero(r.prendas_vendidas), extra: 'Unidades en el periodo', icono: ShoppingBag, color: C.naranja },
    { titulo: 'Ticket promedio', valor: moneda(r.ticket_promedio), extra: 'Por operación', icono: ReceiptText, color: C.dorado },
    { titulo: 'Prendas disponibles', valor: numero(r.prendas_disponibles), extra: 'Existencia actual', icono: Package, color: C.rosa },
    { titulo: 'Valor del inventario', valor: moneda(r.valor_inventario), extra: 'Costo de compra disponible', icono: Wallet, color: C.coral },
  ];

  const pagos = useMemo(() => (d.pagos_por_metodo || []).map((p) => ({ ...p, total: Number(p.total) })), [d]);
  const categorias = useMemo(() => (d.categorias_mas_vendidas || []).map((p) => ({ ...p, total: Number(p.total), utilidad: p.utilidad == null ? null : Number(p.utilidad) })), [d]);
  const ventas = useMemo(() => (d.ventas_diarias || []).map((p) => ({ ...p, total: Number(p.total) })), [d]);
  const comparacion = useMemo(() => (d.ventas_por_sucursal || []).map((p) => ({ ...p, total: Number(p.total), utilidad: p.utilidad == null ? null : Number(p.utilidad) })), [d]);

  const detalle = modal === 'utilidad' ? d.detalle_utilidad || [] : d.prendas_sin_movimiento || [];
  const descargar = () => {
    const esUtilidad = modal === 'utilidad';
    const columnas = esUtilidad ? ['Prenda', 'Categoría', 'Sucursal', 'Cantidad', 'Costo', 'Venta', 'Utilidad', 'Margen %'] : ['Prenda', 'Categoría', 'Sucursal', 'Días sin movimiento', 'Costo'];
    const filas = detalle.map((x) => esUtilidad
      ? [x.prenda, x.categoria, x.sucursal, x.cantidad, x.costo, x.venta, x.utilidad, x.margen]
      : [x.prenda, x.categoria, x.sucursal, x.dias, x.costo]);
    exportarCsv(`ludarope_${modal}_${filtrosAplicados.fechaInicio}_${filtrosAplicados.fechaFin}.csv`, columnas, filas);
  };

  if (!esAdmin) return <div className="p-6 font-semibold text-[#FC4D84]">No tienes permiso para consultar el dashboard.</div>;

  return (
    <main className="relative w-full min-w-0 max-w-full overflow-x-hidden pb-10 text-[#352A30]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#FC4D84]/10 blur-3xl" />
        <div className="absolute left-0 top-[36rem] h-80 w-80 rounded-full bg-[#E7AA44]/10 blur-3xl" />
      </div>
      <div className="relative mx-auto w-full min-w-0 max-w-[1550px] space-y-5 py-1 sm:py-2">
        {/* Encabezado de marca */}
        <header className="relative min-w-0 overflow-hidden rounded-[2rem] border border-[#F2E3E8] bg-gradient-to-br from-white via-[#FFF8FA] to-[#FFF0E5] p-4 shadow-[0_20px_60px_rgba(96,54,70,0.06)] sm:p-6 xl:p-8">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border border-[#FC4D84]/15" />
          <div className="pointer-events-none absolute -right-12 -top-16 h-60 w-60 rounded-full border border-[#FE714B]/20" />
          <div className="relative flex min-w-0 flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.19em] text-[#FC4D84]">LUDAROPE · Panel administrativo</p>
              <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Hola, {usuario?.nombre || 'Administrador'}<span className="text-[#FC4D84]">.</span></h1>
              <p className="mt-3 max-w-xl break-words text-sm leading-relaxed text-[#78636C]">Consulta tus ventas, utilidad y movimiento de prendas en todas tus sucursales.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#F1DAE2] bg-white/80 px-3 py-2 text-xs font-bold text-[#6E5961]"><Store size={14} className="text-[#FC4D84]" />{nombreSucursal}</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#F1DAE2] bg-white/80 px-3 py-2 text-xs font-bold text-[#6E5961]"><CalendarRange size={14} className="text-[#FE714B]" />{filtrosAplicados.fechaInicio} a {filtrosAplicados.fechaFin}</span>
              </div>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 min-[540px]:grid-cols-3 lg:w-[360px] lg:shrink-0">
              {[
                ['Ventas', numero(r.total_ventas)], ['Vendido', moneda(r.total_vendido)], ['Utilidad', moneda(r.utilidad_bruta)],
              ].map(([label, value], index) => <div key={label} className={`min-w-0 rounded-2xl border border-white bg-white/80 p-3 shadow-sm sm:p-3.5 ${index === 2 ? 'col-span-2 min-[540px]:col-span-1' : ''}`}>
                <p className="text-[10px] font-black uppercase tracking-wide text-[#927E86]">{label}</p>
                <p className="mt-2 break-words text-sm font-black sm:text-base" style={{ color: COLORES[index] }}>{cargando ? '...' : value}</p>
              </div>)}
            </div>
          </div>
        </header>

        {/* Filtros */}
        <form onSubmit={aplicarFiltros} className={`${tarjeta} flex flex-col gap-4 xl:flex-row xl:items-end`}>
          <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="min-w-0 text-[11px] font-black uppercase tracking-wider text-[#6E5961]">Sucursal
              <select className={`${campo} mt-2`} value={sucursal} onChange={(e) => setSucursal(e.target.value)}>
                <option value="todas">Todas las sucursales</option>
                {sucursales.map((s) => <option value={s.id_sucursal} key={s.id_sucursal}>{s.nombre}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-[11px] font-black uppercase tracking-wider text-[#6E5961]">Fecha inicio
              <input type="date" className={`${campo} mt-2`} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
            </label>
            <label className="min-w-0 text-[11px] font-black uppercase tracking-wider text-[#6E5961]">Fecha fin
              <input type="date" className={`${campo} mt-2`} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={cargando} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FC4D84] px-5 py-3 text-sm font-black text-white shadow-[0_12px_25px_rgba(252,77,132,0.2)] hover:bg-[#E83B72] disabled:opacity-50 xl:flex-none"><RefreshCw size={17} className={cargando ? 'animate-spin' : ''} /> Actualizar</button>
    
          </div>
        </form>

        {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-[#FE714B]/35 bg-[#FFF0EB] p-4 text-sm font-semibold text-[#914B35]"><CircleAlert className="shrink-0" size={19} />{error}</div>}
        {!error && aviso && <div className="rounded-2xl border border-[#E7AA44]/35 bg-[#FFFBF0] p-4 text-sm font-semibold text-[#8B6B31]">{aviso}</div>}

        {/* Indicadores */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tarjetas.map((t) => {
            const Icono = t.icono;
            const contenido = <>
              <span className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-[.08] blur-xl" style={{ background: t.color }} />
              <div className="relative flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${t.color}18`, color: t.color }}><Icono size={22} /></span>
                {t.accion && <ArrowUpRight size={18} style={{ color: t.color }} />}
              </div>
              <p className="relative mt-5 text-sm font-bold text-[#89747E]">{t.titulo}</p>
              <p className="relative mt-1 break-words text-2xl font-black sm:text-3xl">{cargando ? '...' : t.valor}</p>
              <p className="relative mt-2 text-xs font-medium text-[#A08D94]">{t.extra}</p>
            </>;
            return t.accion ? <button key={t.titulo} type="button" onClick={() => setModal(t.accion)} className={`${tarjeta} cursor-pointer text-left transition hover:-translate-y-1 hover:border-[#FC4D84]/30 hover:shadow-lg`}>{contenido}</button>
              : <div key={t.titulo} className={tarjeta}>{contenido}</div>;
          })}
        </section>

        {/* Gráficas superiores */}
        <section className="grid gap-5 xl:grid-cols-12">
          <article className={`${tarjeta} xl:col-span-8`}>
            <BloqueTitulo etiqueta="Tendencia" titulo="Ventas por día" descripcion="Ingresos registrados en el periodo seleccionado." Icon={ChartColumnIncreasing} />
            {ventas.length ? <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={ventas} margin={{ left: 5, right: 15, top: 10 }}>
              <defs><linearGradient id="ludaropeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.rosa} stopOpacity={0.25} /><stop offset="100%" stopColor={C.rosa} stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid stroke="#F3E8EC" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="fecha" tick={{ fill: C.texto, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(x) => `$${x}`} tick={{ fill: C.texto, fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
              <Tooltip formatter={(v) => moneda(v)} contentStyle={{ borderRadius: 12, borderColor: C.borde }} />
              <Area type="monotone" dataKey="total" name="Ventas" stroke={C.rosa} fill="url(#ludaropeArea)" strokeWidth={3} />
            </AreaChart></ResponsiveContainer></div> : <SinDatos texto="No hay ventas completadas en el periodo seleccionado." />}
          </article>
          <article className={`${tarjeta} xl:col-span-4`}>
            <BloqueTitulo etiqueta="Cobros" titulo="Formas de pago" descripcion="Distribución del importe cobrado." Icon={CreditCard} />
            {pagos.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pagos} dataKey="total" nameKey="metodo" cx="50%" cy="46%" innerRadius={48} outerRadius={82} paddingAngle={4}>
              {pagos.map((p, i) => <Cell key={p.metodo} fill={COLORES[i % COLORES.length]} />)}
            </Pie><Tooltip formatter={(v) => moneda(v)} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div> : <SinDatos texto="No hay pagos registrados para el periodo seleccionado." />}
          </article>
        </section>

        {/* Categorías y sucursales */}
        <section className="grid gap-5 xl:grid-cols-2">
          <article className={tarjeta}>
            <BloqueTitulo etiqueta="Rendimiento" titulo="Categorías más vendidas" descripcion="Ingresos y utilidad por tipo de prenda, no por pieza individual." Icon={ShoppingBag} />
            {categorias.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={categorias} margin={{ left: 0, right: 5, bottom: 5 }}>
              <CartesianGrid stroke="#F3E8EC" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="categoria" tick={{ fill: C.texto, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.texto, fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={(v) => moneda(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total" name="Vendido" fill={C.rosa} radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="utilidad" name="Utilidad bruta" fill={C.coral} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart></ResponsiveContainer></div> : <SinDatos texto="No hay prendas vendidas en el periodo seleccionado." />}
          </article>
          <article className={tarjeta}>
            <BloqueTitulo etiqueta="Multisucursal" titulo="Comparativa por sucursal" descripcion="Ventas y utilidad bruta de cada tienda." Icon={Store} />
            {filtrosAplicados.sucursal !== 'todas' ? <SinDatos texto="Selecciona Todas las sucursales para comparar sus resultados." /> : comparacion.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparacion} layout="vertical" margin={{ left: 12, right: 15 }}>
              <CartesianGrid stroke="#F3E8EC" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: C.texto, fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="sucursal" width={140} tick={{ fill: C.texto, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => moneda(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total" name="Vendido" fill={C.naranja} radius={[0, 6, 6, 0]} maxBarSize={20} />
              <Bar dataKey="utilidad" name="Utilidad bruta" fill={C.dorado} radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart></ResponsiveContainer></div> : <SinDatos texto="No se registraron ventas por sucursal en estas fechas." />}
          </article>
        </section>

        {/* Ventas recientes y mercancía rezagada */}
        <section className="grid gap-5 xl:grid-cols-12">
          <article className={`${tarjeta} xl:col-span-8`}>
            <BloqueTitulo etiqueta="Actividad" titulo="Últimas ventas" descripcion="Movimientos recientes de todas las cajas incluidas en el filtro." Icon={ReceiptText} />
            <div className="overflow-x-auto rounded-2xl border border-[#F2E3E8]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#FFF4F6] text-[11px] uppercase tracking-wide text-[#806B74]"><tr>{['Folio', 'Fecha', 'Sucursal', 'Cajero', 'Método', 'Total'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#F5E9EC]">
                  {(d.ultimas_ventas || []).length === 0 ? <tr><td colSpan="6" className="px-5 py-12 text-center text-[#907C85]">No hay ventas completadas en este periodo.</td></tr>
                    : d.ultimas_ventas.map((v, i) => <tr key={v.id_venta ?? i} className="hover:bg-[#FFF9FA]">
                      <td className="px-4 py-3 font-black">{v.folio}</td><td className="whitespace-nowrap px-4 py-3">{fechaHora(v.fecha_venta)}</td>
                      <td className="px-4 py-3">{v.sucursal || '—'}</td><td className="px-4 py-3">{v.cajero || '—'}</td>
                      <td className="px-4 py-3">{v.metodo_pago || '—'}</td><td className="px-4 py-3 text-right font-black text-[#FC4D84]">{moneda(v.total)}</td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </article>
          <article className={`${tarjeta} xl:col-span-4`}>
            <BloqueTitulo etiqueta="Inventario" titulo="Prendas sin ventas recientes" descripcion="Días desde la última venta o el alta, con stock actual." Icon={Package} />
            {(d.prendas_sin_movimiento || []).length ? <div className="space-y-2">
              {d.prendas_sin_movimiento.slice(0, 5).map((p, i) => <div key={p.id_prenda ?? i} className="flex items-center justify-between gap-3 rounded-2xl border border-[#F3E8EC] bg-[#FFFAFB] p-3.5">
                <div className="min-w-0"><p className="truncate text-sm font-black text-[#352A30]">{p.prenda}</p><p className="truncate text-xs text-[#907C85]">{p.sucursal}</p></div>
                <span className="shrink-0 rounded-xl bg-[#FFF1DD] px-3 py-1.5 text-xs font-black text-[#A86B16]">{numero(p.dias)} días</span>
              </div>)}
              <button type="button" onClick={() => setModal('sin_movimiento')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-bold text-[#FC4D84] hover:bg-[#FFE3EC]">Ver detalle <ArrowUpRight size={16} /></button>
            </div> : <SinDatos texto="No hay prendas disponibles para analizar." />}
          </article>
        </section>
      </div>

      {modal && <Modal titulo={modal === 'utilidad' ? 'Utilidad por prenda vendida' : 'Prendas sin ventas recientes'} descripcion={modal === 'utilidad' ? 'Costo histórico al momento de la venta; NULL indica pendiente de costeo.' : 'Días desde la última venta o desde el alta de la prenda.'} alCerrar={() => setModal(null)}>
        {modal === 'utilidad' && d.detalle_utilidad_truncado && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Se muestran 1,000 detalles. Reduce el rango de fechas para consultar y exportar el resto.</div>}
        <TablaDetalle tipo={modal} filas={detalle} exportar={descargar} />
      </Modal>}
    </main>
  );
}
