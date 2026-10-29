import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
  Store, Plus, Search, RefreshCw, Pencil, Power, PowerOff,
  MapPin, Phone, Users, Wallet, Package, X, Save, Loader2,
  CheckCircle2, CircleOff, Building2, AlertCircle,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const ROSA = '#FC4D84';
const VACIO = { nombre: '', direccion: '', telefono: '' };
const esActiva = (x) => [true, 1, '1', 'true'].includes(x?.activo);
const formatoFecha = (f) => {
  if (!f) return '—';
  const fecha = new Date(f);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-MX', { dateStyle: 'medium' });
};
const campoClase = 'block w-full min-w-0 rounded-2xl border border-[#EEDDE5] bg-white px-4 py-3 text-sm font-semibold text-[#4A3642] outline-none transition placeholder:font-normal placeholder:text-[#B2A0A9] focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10 disabled:opacity-60';

function Indicador({ activo }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      {activo ? <CheckCircle2 size={13} /> : <CircleOff size={13} />}
      {activo ? 'Activa' : 'Inactiva'}
    </span>
  );
}

function Kpi({ titulo, valor, descripcion, Icono, tono = 'rosa' }) {
  const colores = {
    rosa: 'bg-[#FFF0F5] text-[#FC4D84]',
    naranja: 'bg-[#FFF1E9] text-[#FE714B]',
    verde: 'bg-emerald-50 text-emerald-700',
    oro: 'bg-[#FFF7E3] text-[#A87515]',
  };
  return (
    <article className="rounded-[1.5rem] border border-[#F1E1E8] bg-white p-5 shadow-[0_12px_28px_rgba(70,35,52,.04)]">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${colores[tono]}`}><Icono size={20} /></div>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[.12em] text-[#99818D]">{titulo}</p>
      <p className="mt-1 text-3xl font-black text-[#302730]">{valor}</p>
      <p className="mt-1 text-xs text-[#9D8791]">{descripcion}</p>
    </article>
  );
}

function Dato({ icono: Icono, etiqueta, valor }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icono size={16} className="mt-0.5 shrink-0 text-[#C88AA1]" />
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#A08A94]">{etiqueta}</p>
        <p className="mt-1 break-words text-sm font-semibold text-[#5C4B54]">{valor || 'No registrado'}</p>
      </div>
    </div>
  );
}

function Metrica({ Icono, valor, etiqueta }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#FFF7FA] px-3 py-2">
      <Icono size={15} className="shrink-0 text-[#FC4D84]" />
      <div>
        <p className="text-sm font-black leading-none text-[#47333F]">{valor || 0}</p>
        <p className="mt-1 text-[10px] font-semibold text-[#99818D]">{etiqueta}</p>
      </div>
    </div>
  );
}

export default function Sucursales() {
  const { usuario } = useAuth();
  const esAdmin = String(usuario?.rol || '').trim().toUpperCase() === 'ADMIN';
  const [sucursales, setSucursales] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODAS');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [actualizandoEstado, setActualizandoEstado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError('');
      const { data } = await api.get('/admin/sucursales');
      if (!data?.ok) throw new Error(data?.mensaje || 'No se pudieron cargar las sucursales.');
      setSucursales(data.sucursales || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || err.message || 'Error al consultar sucursales.');
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { if (esAdmin) cargar(); }, [esAdmin, cargar]);

  useEffect(() => {
    if (!modal) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (e) => {
      if (e.key === 'Escape' && !guardando) setModal(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', escape);
    };
  }, [modal, guardando]);

  const lista = useMemo(() => {
    const texto = buscar.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return sucursales.filter((s) => {
      if (filtroEstado === 'ACTIVAS' && !esActiva(s)) return false;
      if (filtroEstado === 'INACTIVAS' && esActiva(s)) return false;
      if (!texto) return true;
      return [s.nombre, s.direccion, s.telefono, s.id_sucursal]
        .some((x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(texto));
    });
  }, [sucursales, buscar, filtroEstado]);

  const resumen = useMemo(() => ({
    total: sucursales.length,
    activas: sucursales.filter(esActiva).length,
    inactivas: sucursales.filter((s) => !esActiva(s)).length,
    cajas: sucursales.reduce((n, s) => n + Number(s.cajas_activas || 0), 0),
  }), [sucursales]);

  function nuevaSucursal() {
    setEditando(null);
    setForm({ ...VACIO });
    setModal(true);
  }
  function editarSucursal(s) {
    setEditando(s);
    setForm({ nombre: s.nombre || '', direccion: s.direccion || '', telefono: s.telefono || '' });
    setModal(true);
  }
  function cerrarModal() {
    if (guardando) return;
    setModal(false);
    setEditando(null);
    setForm({ ...VACIO });
  }

  async function guardar(e) {
    e.preventDefault();
    const nombre = form.nombre.trim();
    const direccion = form.direccion.trim();
    const telefono = form.telefono.trim();
    if (nombre.length < 2 || nombre.length > 150) {
      return Swal.fire({ icon: 'warning', title: 'Nombre inválido', text: 'Usa entre 2 y 150 caracteres.', confirmButtonColor: ROSA });
    }
    if (direccion.length > 2000 || telefono.length > 20 || (telefono && !/^[+0-9()\s.\-]+$/.test(telefono))) {
      return Swal.fire({ icon: 'warning', title: 'Revisa los datos', text: 'La dirección admite 2000 caracteres y el teléfono máximo 20.', confirmButtonColor: ROSA });
    }
    try {
      setGuardando(true);
      const payload = { nombre, direccion, telefono };
      const { data } = editando
        ? await api.put(`/admin/sucursales/${editando.id_sucursal}`, payload)
        : await api.post('/admin/sucursales', payload);
      if (!data?.ok) throw new Error(data?.mensaje || 'No se pudo guardar la sucursal.');
      const fueEdicion = Boolean(editando);
      cerrarModalForzado();
      await cargar();
      Swal.fire({ icon: 'success', title: fueEdicion ? 'Sucursal actualizada' : 'Sucursal creada', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.response?.data?.mensaje || err.message, confirmButtonColor: ROSA });
    } finally { setGuardando(false); }
  }

  function cerrarModalForzado() {
    setModal(false);
    setEditando(null);
    setForm({ ...VACIO });
  }

  async function cambiarEstado(s) {
    const activar = !esActiva(s);
    const detalles = activar
      ? 'La sucursal volverá a estar disponible para su configuración y operación.'
      : 'Para desactivarla no debe haber usuarios ni cajas activas, sesiones abiertas o prendas en existencia.';
    const confirmacion = await Swal.fire({
      icon: 'question', title: activar ? '¿Activar sucursal?' : '¿Desactivar sucursal?',
      text: `${s.nombre}. ${detalles}`,
      showCancelButton: true, confirmButtonText: activar ? 'Sí, activar' : 'Sí, desactivar',
      cancelButtonText: 'Cancelar', confirmButtonColor: ROSA,
    });
    if (!confirmacion.isConfirmed) return;
    try {
      setActualizandoEstado(s.id_sucursal);
      const { data } = await api.patch(`/admin/sucursales/${s.id_sucursal}/estado`, { activo: activar });
      if (!data?.ok) throw new Error(data?.mensaje || 'No se pudo cambiar el estado.');
      await cargar();
      Swal.fire({ icon: 'success', title: activar ? 'Sucursal activada' : 'Sucursal desactivada', timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo cambiar el estado', text: err.response?.data?.mensaje || err.message, confirmButtonColor: ROSA });
    } finally { setActualizandoEstado(null); }
  }

  if (!esAdmin) {
    return (
      <div className="rounded-3xl border border-[#F1DFE6] bg-white p-10 text-center">
        <AlertCircle size={30} className="mx-auto text-[#FC4D84]" />
        <h1 className="mt-3 text-xl font-black text-[#392B35]">Acceso restringido</h1>
        <p className="mt-2 text-sm text-[#89747E]">Solo ADMIN puede administrar sucursales.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-hidden pb-10 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#F1DEE6] bg-white p-5 shadow-[0_16px_42px_rgba(71,36,51,.05)] sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#FC4D84]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-[20%] h-52 w-52 rounded-full bg-[#FE714B]/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#FE714B]">LUDAROPE · Administración</p>
              <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Sucursales<span className="text-[#FC4D84]">.</span></h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#907A85]">Gestiona tus tiendas, sus datos de contacto y su disponibilidad operativa.</p>
            </div>
          </div>
          <button type="button" onClick={nuevaSucursal} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FC4D84] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(252,77,132,.22)] transition hover:-translate-y-0.5 hover:bg-[#E73B71]">
            <Plus size={18} /> Nueva sucursal
          </button>
        </div>
        <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FC4D84]" />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} className={`${campoClase} pl-12`} placeholder="Busca por nombre, dirección o teléfono..." aria-label="Buscar sucursales" />
          </div>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={`${campoClase} sm:max-w-[190px]`} aria-label="Filtrar por estado">
            <option value="TODAS">Todos los estados</option>
            <option value="ACTIVAS">Activas</option>
            <option value="INACTIVAS">Inactivas</option>
          </select>
          <button type="button" onClick={cargar} disabled={cargando} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#302730] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#47343F] disabled:opacity-50">
            {cargando ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Actualizar
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        <Kpi titulo="Total de tiendas" valor={resumen.total} descripcion="Sucursales registradas" Icono={Store} />
        <Kpi titulo="Activas" valor={resumen.activas} descripcion="Disponibles para operar" Icono={CheckCircle2} tono="verde" />
        <Kpi titulo="Inactivas" valor={resumen.inactivas} descripcion="Fuera de operación" Icono={CircleOff} tono="naranja" />
        <Kpi titulo="Cajas activas" valor={resumen.cajas} descripcion="En todas las sucursales" Icono={Wallet} tono="oro" />
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle size={18} className="shrink-0" /> {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[2rem] border border-[#F1DEE6] bg-white shadow-[0_14px_38px_rgba(71,36,51,.045)]">
        <header className="flex items-center justify-between border-b border-[#F4E7EC] px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-[#3D2F38]">Sucursales registradas</h2>
            <p className="mt-1 text-xs text-[#9A8590]">{lista.length} resultado(s) · Las sucursales inactivas conservan su historial.</p>
          </div>
          <Store size={20} className="text-[#FC4D84]" />
        </header>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm font-bold text-[#927A87]"><Loader2 size={19} className="animate-spin text-[#FC4D84]" /> Cargando sucursales...</div>
        ) : lista.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-[#9A8590]">No se encontraron sucursales para los filtros seleccionados.</div>
        ) : (
          <>
            <div className="grid gap-4 p-4 lg:hidden">
              {lista.map((s) => (
                <article key={s.id_sucursal} className="rounded-[1.5rem] border border-[#F2E3E9] bg-[#FFFCFD] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#FC4D84]"><Store size={21} /></div>
                      <div className="min-w-0">
                        <h3 className="break-words font-black text-[#3C2D37]">{s.nombre}</h3>
                        <p className="mt-1 text-[11px] font-bold text-[#AA919D]">Sucursal #{s.id_sucursal}</p>
                      </div>
                    </div>
                    <Indicador activo={esActiva(s)} />
                  </div>
                  <div className="mt-4 space-y-3"><Dato icono={MapPin} etiqueta="Dirección" valor={s.direccion} /><Dato icono={Phone} etiqueta="Teléfono" valor={s.telefono} /></div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Metrica Icono={Users} etiqueta="Usuarios" valor={s.usuarios_activos} />
                    <Metrica Icono={Wallet} etiqueta="Cajas" valor={s.cajas_activas} />
                    <Metrica Icono={Package} etiqueta="Existencias" valor={s.prendas_existencia} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => editarSucursal(s)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFF0F5] px-3 py-3 text-xs font-black text-[#C93C6F]"><Pencil size={16} /> Editar</button>
                    <button type="button" disabled={actualizandoEstado === s.id_sucursal} onClick={() => cambiarEstado(s)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black disabled:opacity-50 ${esActiva(s) ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                      {esActiva(s) ? <PowerOff size={16} /> : <Power size={16} />}{esActiva(s) ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="border-b border-[#F4E7EC] bg-[#FFFAFB]">
                  <tr>{['Sucursal','Contacto','Usuarios','Cajas','Existencias','Estado','Alta','Acciones'].map((titulo) => <th key={titulo} className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-[.07em] text-[#9C8691]">{titulo}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[#F5EAEF]">
                  {lista.map((s) => (
                    <tr key={s.id_sucursal} className="transition hover:bg-[#FFFAFB]">
                      <td className="px-5 py-4"><p className="max-w-[205px] break-words text-sm font-black text-[#3E3039]">{s.nombre}</p><p className="mt-1 text-xs text-[#A38D98]">#{s.id_sucursal}</p></td>
                      <td className="px-5 py-4"><p className="max-w-[260px] break-words text-xs font-semibold text-[#6E5A64]">{s.direccion || 'Sin dirección'}</p><p className="mt-1 text-xs text-[#AA8C99]">{s.telefono || 'Sin teléfono'}</p></td>
                      <td className="px-5 py-4 text-center text-sm font-bold text-[#624C59]">{s.usuarios_activos ?? 0}</td>
                      <td className="px-5 py-4 text-center text-sm font-bold text-[#624C59]">{s.cajas_activas ?? 0}</td>
                      <td className="px-5 py-4 text-center text-sm font-bold text-[#624C59]">{s.prendas_existencia ?? 0}</td>
                      <td className="px-5 py-4"><Indicador activo={esActiva(s)} /></td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-[#87717C]">{formatoFecha(s.fecha_creacion)}</td>
                      <td className="px-5 py-4"><div className="flex items-center gap-2">
                        <button type="button" onClick={() => editarSucursal(s)} title="Editar sucursal" aria-label={`Editar ${s.nombre}`} className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF0F5] text-[#C93C6F] transition hover:bg-[#FFE2EC]"><Pencil size={16} /></button>
                        <button type="button" disabled={actualizandoEstado === s.id_sucursal} onClick={() => cambiarEstado(s)} title={esActiva(s) ? 'Desactivar sucursal' : 'Activar sucursal'} aria-label={`${esActiva(s) ? 'Desactivar' : 'Activar'} ${s.nombre}`} className={`grid h-9 w-9 place-items-center rounded-xl transition disabled:opacity-50 ${esActiva(s) ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{esActiva(s) ? <PowerOff size={16} /> : <Power size={16} />}</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {modal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[#211820]/60 p-3 backdrop-blur-sm sm:p-6" role="presentation">
          <button type="button" aria-label="Cerrar ventana" onClick={cerrarModal} className="absolute inset-0 h-full w-full cursor-default" />
          <section role="dialog" aria-modal="true" aria-label={editando ? 'Editar sucursal' : 'Nueva sucursal'} className="relative my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_30px_80px_rgba(53,29,41,.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#F4E6EB] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#FC4D84]">LUDAROPE · Sucursales</p>
                <h2 className="mt-2 font-serif text-2xl font-bold text-[#382B35]">{editando ? 'Editar sucursal' : 'Nueva sucursal'}</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#907E87]">{editando ? 'Actualiza los datos comerciales, sin afectar el historial.' : 'Registra una nueva ubicación para inventario, personal y cajas.'}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={cerrarModal} disabled={guardando} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#C44876] disabled:opacity-50"><X size={20} /></button>
            </div>
            <form onSubmit={guardar} className="flex min-h-0 flex-col">
              <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <div>
                  <label htmlFor="sucursal-nombre" className="mb-2 block text-sm font-black text-[#5C4653]">Nombre de sucursal *</label>
                  <input id="sucursal-nombre" autoFocus required maxLength={150} value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} className={campoClase} placeholder="Ej. Sucursal Principal" />
                </div>
                <div>
                  <label htmlFor="sucursal-direccion" className="mb-2 block text-sm font-black text-[#5C4653]">Dirección</label>
                  <textarea id="sucursal-direccion" rows={3} maxLength={2000} value={form.direccion} onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))} className={`${campoClase} resize-y`} placeholder="Calle, número, colonia, ciudad y código postal" />
                </div>
                <div>
                  <label htmlFor="sucursal-telefono" className="mb-2 block text-sm font-black text-[#5C4653]">Teléfono de contacto</label>
                  <input id="sucursal-telefono" type="tel" inputMode="tel" maxLength={20} value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} className={campoClase} placeholder="Ej. 771 123 4567" />
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-[#F5E3EA] bg-[#FFF8FB] px-4 py-3">
                  <Store size={20} className="mt-0.5 shrink-0 text-[#FC4D84]" />
                  <p className="text-xs leading-relaxed text-[#89717F]">{editando ? 'El estado activo/inactivo se gestiona desde el listado. El identificador no cambia y se conservan todas las relaciones.' : 'La sucursal se creará activa. Después podrás registrar cajas y asignarle empleados.'}</p>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-[#F4E6EB] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button type="button" onClick={cerrarModal} disabled={guardando} className="rounded-xl border border-[#F1D6E0] px-5 py-3 text-sm font-black text-[#8A6676] disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-6 py-3 text-sm font-black text-white transition hover:bg-[#E73B71] disabled:opacity-50">{guardando ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear sucursal'}</button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
