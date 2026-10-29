import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileWarning, LockKeyhole, RefreshCw, Search, TrendingUp, Wallet } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../../api/axios';

const money = (v) => Number(v || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const input = 'w-full min-w-0 rounded-xl border border-[#EED8E1] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10';

export default function CostosPrendas() {
  const [prendas, setPrendas] = useState([]);
  const [borrador, setBorrador] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('pendientes');
  const [guardando, setGuardando] = useState({});
  const [cargando, setCargando] = useState(true);
  const [mensajeError, setMensajeError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setCargando(true); setMensajeError('');
      const { data } = await api.get('/inventario/costos');
      setPrendas(data.prendas || []);
      setBorrador(Object.fromEntries((data.prendas || []).map((p) => [p.id_prenda, p.costo_unitario == null ? '' : String(p.costo_unitario)])));
    } catch (e) { setMensajeError(e.response?.data?.mensaje || 'No se pudieron cargar los costos'); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const pendientes = prendas.filter((p) => p.costo_unitario == null).length;
  const completas = prendas.length - pendientes;
  const lista = useMemo(() => prendas.filter((p) => {
    const coincide = [p.nombre,p.categoria,p.talla,p.color,`LDR-${String(p.id_prenda).padStart(6,'0')}`]
      .join(' ').toLowerCase().includes(busqueda.trim().toLowerCase());
    return coincide && (filtro === 'todas' || (filtro === 'pendientes' ? p.costo_unitario == null : p.costo_unitario != null));
  }), [prendas, busqueda, filtro]);
  const guardar = async (p) => {
    const valor = String(borrador[p.id_prenda] ?? '').trim();
    if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(valor)) {
      return Swal.fire('Costo inválido', 'Escribe una cantidad válida, con máximo dos decimales.', 'warning');
    }
    try {
      setGuardando((prev) => ({ ...prev, [p.id_prenda]: true }));
      await api.put(`/inventario/costos/${p.id_prenda}`, { costo_unitario: valor });
      setPrendas((prev) => prev.map((x) => x.id_prenda === p.id_prenda ? { ...x, costo_unitario: valor } : x));
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Costo guardado', timer: 1200, showConfirmButton: false });
    } catch (e) { Swal.fire('Error', e.response?.data?.mensaje || 'No se pudo guardar el costo', 'error'); }
    finally { setGuardando((prev) => ({ ...prev, [p.id_prenda]: false })); }
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 text-[#352A30]">
      <section className="rounded-[2rem] border border-[#F1DFE5] bg-gradient-to-br from-white via-[#FFF8FA] to-[#FFF1E8] p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[.17em] text-[#FC4D84]">LUDAROPE · ADMINISTRACIÓN</p>
        <div className="mt-2 flex items-start justify-between gap-4"><div><h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Asignación de costos<span className="text-[#FC4D84]">.</span></h1>
          <p className="mt-2 text-sm text-[#806B73]">Captura costos por prenda para los futuros reportes de utilidad.</p></div>
          <div className="rounded-2xl bg-[#FFF0F5] p-3 text-[#FC4D84]"><LockKeyhole size={25}/></div>
        </div>
      </section>
      {mensajeError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{mensajeError}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Prendas por costear',pendientes,FileWarning,'#FC4D84'],['Con costo registrado',completas,Check,'#FE714B'],['Total de referencias',prendas.length,Wallet,'#E7AA44']].map(([titulo,valor,Icon,color]) => (
          <div key={titulo} className="rounded-2xl border border-[#F0DDE4] bg-white p-5 shadow-sm"><Icon style={{color}} size={20}/><p className="mt-3 text-xs font-bold text-[#8A717D]">{titulo}</p><p className="mt-1 text-3xl font-black">{cargando?'...':valor}</p></div>
        ))}
      </div>
      <section className="rounded-[1.7rem] border border-[#F0DDE4] bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div><label className="mb-1 block text-xs font-bold text-[#856B76]">Buscar prendas</label><div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FC4D84]"/><input value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} className={`${input} pl-10`} placeholder="Nombre, talla, color o código"/></div></div>
          <select className={input} value={filtro} onChange={(e)=>setFiltro(e.target.value)}><option value="pendientes">Pendientes</option><option value="completas">Con costo</option><option value="todas">Todas</option></select>
          <button type="button" onClick={cargar} title="Actualizar" className="rounded-xl border border-[#EED8E1] p-3 text-[#FC4D84]"><RefreshCw size={18}/></button>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-[#F1DFE6]">
          <table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-[#FFF5F8] text-[11px] uppercase tracking-wider text-[#8D7280]"><tr>{['Prenda','Precio venta','Stock actual','Costo unitario','Ganancia/unidad','Acción'].map(t=><th className="px-4 py-3" key={t}>{t}</th>)}</tr></thead>
            <tbody>
              {lista.map((p) => {
                const n = borrador[p.id_prenda] === '' ? null : Number(borrador[p.id_prenda]);
                const margen = n === null || !Number.isFinite(n) ? null : Number(p.precio_venta) - n;
                return (<tr key={p.id_prenda} className="border-t border-[#F4E6EB] hover:bg-[#FFFCFD]">
                  <td className="px-4 py-3"><p className="font-bold text-[#412F37]">{p.nombre}</p><p className="text-xs text-[#9D8791]">LDR-{String(p.id_prenda).padStart(6,'0')} · {p.talla} · {p.color}</p></td>
                  <td className="px-4 py-3 font-semibold">{money(p.precio_venta)}</td>
                  <td className="px-4 py-3">{p.stock_actual}</td>
                  <td className="w-40 px-4 py-3"><input aria-label={`Costo unitario ${p.nombre}`} type="number" min="0" step="0.01" placeholder="Pendiente" value={borrador[p.id_prenda] ?? ''} onChange={e=>setBorrador(prev=>({...prev,[p.id_prenda]:e.target.value}))} className={input}/></td>
                  <td className="px-4 py-3 font-bold" style={{color:margen===null?'#9C8790':margen>=0?'#15803D':'#D43151'}}>{margen===null?'Pendiente':money(margen)}</td>
                  <td className="px-4 py-3"><button type="button" disabled={guardando[p.id_prenda] || String(borrador[p.id_prenda]??'').trim()===''} onClick={()=>guardar(p)} className="rounded-xl bg-[#FC4D84] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Check size={15} className="mr-1 inline"/>Guardar</button></td>
                </tr>);
              })}
              {!lista.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#937B87]">{cargando?'Cargando registros...':'No hay prendas que coincidan con el filtro.'}</td></tr>}
            </tbody></table>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-[#947A85]"><TrendingUp size={16} className="shrink-0"/>La ganancia indicada es bruta por unidad, sin gastos. Los costos pendientes no se consideran como cero; el dashboard calculará reportes cuando se implemente ventas.</p>
      </section>
    </div>
  );
}
