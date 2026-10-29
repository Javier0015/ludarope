import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
  Users, UserRound, UserPlus, ShieldCheck, BadgeCheck, Store,
  Search, RefreshCw, Pencil, LockKeyhole, Mail, Eye, EyeOff,
  Power, PowerOff, X, Save, Loader2, CheckCircle2, CircleOff,
  CalendarDays, Sparkles, AlertCircle, KeyRound, UserCog,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const ROSA = '#FC4D84';
const INICIAL = {
  nombre: '', usuario: '', correo: '', rol: 'CAJERO', id_sucursal: '',
  password: '', activo: true,
};
const rolNormalizado = (u) => String(u?.rol || '').trim().toUpperCase();
const estaActivo = (u) => [true, 1, 'true', '1'].includes(u?.activo);
const formatoFecha = (f) => {
  if (!f) return 'Sin registro';
  const fecha = new Date(f);
  return Number.isNaN(fecha.getTime()) ? 'Sin registro' : fecha.toLocaleDateString('es-MX', { dateStyle: 'medium' });
};
const control = 'block w-full min-w-0 rounded-2xl border border-[#EFDCE4] bg-white px-4 py-3 text-sm font-semibold text-[#45333D] outline-none transition focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10 disabled:opacity-60';

function TarjetaKpi({ titulo, valor, descripcion, Icono, color = 'rosa' }) {
  const tono = color === 'naranja'
    ? 'bg-[#FFF0E9] text-[#FE714B]'
    : color === 'oro' ? 'bg-[#FFF7E4] text-[#A87515]'
      : color === 'verde' ? 'bg-emerald-50 text-emerald-700'
        : 'bg-[#FFF0F5] text-[#FC4D84]';
  return (
    <article className="rounded-[1.5rem] border border-[#F2E2E8] bg-white p-4 shadow-[0_12px_28px_rgba(70,35,52,.035)] sm:p-5">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${tono}`}><Icono size={21} /></div>
      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[.13em] text-[#9D8490]">{titulo}</p>
      <p className="mt-1 text-3xl font-black text-[#302730]">{valor}</p>
      <p className="mt-1 text-xs text-[#A68C97]">{descripcion}</p>
    </article>
  );
}

function Rol({ valor }) {
  const admin = String(valor).toUpperCase() === 'ADMIN';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold ${admin
      ? 'border-[#F7C5D5] bg-[#FFF0F5] text-[#C63C6D]'
      : 'border-[#F6DFC0] bg-[#FFF7E9] text-[#A46821]'}`}>
      {admin ? <ShieldCheck size={13} /> : <UserRound size={13} />}
      {admin ? 'Administrador' : 'Cajero'}
    </span>
  );
}

function Estado({ valor }) {
  const activo = estaActivo({ activo: valor });
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold ${activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
    {activo ? <CheckCircle2 size={13} /> : <CircleOff size={13} />}
    {activo ? 'Activo' : 'Inactivo'}
  </span>;
}

function Encabezado({ children }) {
  return <th className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-[.09em] text-[#987F8A]">{children}</th>;
}

export default function Usuarios() {
  const { usuario: sesion } = useAuth();
  const miId = Number(sesion?.id_usuario);
  const administrador = rolNormalizado(sesion) === 'ADMIN';

  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('TODOS');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [form, setForm] = useState(INICIAL);
  const [verPassword, setVerPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError('');
      const [rUsuarios, rSucursales] = await Promise.all([
        api.get('/usuarios'), api.get('/usuarios/sucursales'),
      ]);
      if (!rUsuarios.data?.ok || !rSucursales.data?.ok) throw new Error('No fue posible cargar la información.');
      setUsuarios((rUsuarios.data.usuarios || []).filter((u) => ['ADMIN', 'CAJERO'].includes(rolNormalizado(u))));
      setSucursales(rSucursales.data.sucursales || []);
    } catch (e) {
      const mensaje = e.response?.data?.mensaje || e.message || 'No se pudo consultar la lista.';
      setError(mensaje);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { if (administrador) cargar(); }, [administrador, cargar]);

  useEffect(() => {
    if (!modal) return undefined;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (e) => { if (e.key === 'Escape' && !guardando) cerrar(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previo; document.removeEventListener('keydown', escape); };
  }, [modal, guardando]);

  const listaFiltrada = useMemo(() => {
    const q = busqueda.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    return usuarios.filter((u) => {
      if (filtroRol !== 'TODOS' && rolNormalizado(u) !== filtroRol) return false;
      if (filtroEstado !== 'TODOS' && (estaActivo(u) ? 'ACTIVOS' : 'INACTIVOS') !== filtroEstado) return false;
      if (!q) return true;
      return [u.nombre, u.usuario, u.correo, u.sucursal, u.rol].some((campo) =>
        String(campo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q),
      );
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  const contadores = useMemo(() => ({
    total: usuarios.length,
    admins: usuarios.filter((u) => rolNormalizado(u) === 'ADMIN').length,
    cajeros: usuarios.filter((u) => rolNormalizado(u) === 'CAJERO').length,
    activos: usuarios.filter(estaActivo).length,
  }), [usuarios]);

  function abrirNuevo() {
    setSeleccionado(null);
    setForm({ ...INICIAL });
    setVerPassword(false);
    setModal(true);
  }
  function abrirEditar(item) {
    setSeleccionado(item);
    setForm({
      nombre: item.nombre || '', usuario: item.usuario || '',
      correo: item.correo || '', rol: rolNormalizado(item),
      id_sucursal: item.id_sucursal ? String(item.id_sucursal) : '',
      password: '', activo: estaActivo(item),
    });
    setVerPassword(false);
    setModal(true);
  }
  function cerrar() {
    if (guardando) return;
    setModal(false);
    setSeleccionado(null);
    setForm({ ...INICIAL });
    setVerPassword(false);
  }
  const cambiar = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    const nombre = form.nombre.trim();
    const usuario = form.usuario.trim().toLowerCase();
    const correo = form.correo.trim();
    const sucursal = form.id_sucursal ? Number(form.id_sucursal) : null;
    if (nombre.length < 2 || !/^[a-zA-Z0-9._-]{4,60}$/.test(usuario)) {
      return Swal.fire({ icon: 'warning', title: 'Revisa los campos', text: 'Ingresa un nombre válido y un usuario de 4 a 60 caracteres.', confirmButtonColor: ROSA });
    }
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return Swal.fire({ icon: 'warning', title: 'Correo inválido', confirmButtonColor: ROSA });
    }
    if (form.rol === 'CAJERO' && !sucursal) {
      return Swal.fire({ icon: 'warning', title: 'Selecciona una sucursal', text: 'Todo cajero debe pertenecer a una sucursal.', confirmButtonColor: ROSA });
    }
    if ((!seleccionado || form.password) && (form.password.length < 8 || new TextEncoder().encode(form.password).length > 72)) {
      return Swal.fire({ icon: 'warning', title: 'Contraseña inválida', text: 'Usa al menos 8 caracteres y un máximo de 72 bytes.', confirmButtonColor: ROSA });
    }
    if (seleccionado && Number(seleccionado.id_usuario) === miId && form.rol !== 'ADMIN') {
      return Swal.fire({ icon: 'warning', title: 'Operación no permitida', text: 'No puedes quitarte el rol de administrador.', confirmButtonColor: ROSA });
    }
    const payload = {
      nombre, usuario, correo: correo || null,
      rol: form.rol, id_sucursal: sucursal, activo: Boolean(form.activo),
    };
    if (form.password) payload.password = form.password;
    try {
      setGuardando(true);
      const r = seleccionado
        ? await api.put(`/usuarios/${seleccionado.id_usuario}`, payload)
        : await api.post('/usuarios', payload);
      if (!r.data?.ok) throw new Error(r.data?.mensaje || 'No fue posible guardar.');
      setModal(false);
      setSeleccionado(null);
      setForm({ ...INICIAL });
      await cargar();
      Swal.fire({ icon: 'success', title: seleccionado ? 'Usuario actualizado' : 'Usuario creado', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err.response?.data?.mensaje || err.message, confirmButtonColor: ROSA });
    } finally { setGuardando(false); }
  }

  async function cambiarEstado(item) {
    const activo = !estaActivo(item);
    if (!activo && Number(item.id_usuario) === miId) {
      return Swal.fire({ icon: 'warning', title: 'No puedes desactivar tu propia cuenta', confirmButtonColor: ROSA });
    }
    const confirmacion = await Swal.fire({
      icon: 'question', title: activo ? '¿Activar usuario?' : '¿Desactivar usuario?',
      text: activo ? `${item.nombre} podrá volver a ingresar.` : `${item.nombre} dejará de poder iniciar sesión.`,
      showCancelButton: true, confirmButtonText: activo ? 'Sí, activar' : 'Sí, desactivar',
      cancelButtonText: 'Cancelar', confirmButtonColor: ROSA,
    });
    if (!confirmacion.isConfirmed) return;
    try {
      setCambiandoEstado(item.id_usuario);
      const r = await api.patch(`/usuarios/${item.id_usuario}/estado`, { activo });
      if (!r.data?.ok) throw new Error(r.data?.mensaje || 'No fue posible cambiar el estado.');
      await cargar();
      Swal.fire({ icon: 'success', title: activo ? 'Cuenta activada' : 'Cuenta desactivada', timer: 1300, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: err.response?.data?.mensaje || err.message, confirmButtonColor: ROSA });
    } finally { setCambiandoEstado(null); }
  }

  const Acciones = ({ item }) => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" title="Editar usuario" aria-label={`Editar a ${item.nombre}`} onClick={() => abrirEditar(item)} className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF0F5] text-[#D33F73] transition hover:bg-[#FDE2EC]"><Pencil size={16}/></button>
      <button type="button" title={estaActivo(item) ? 'Desactivar' : 'Activar'} aria-label={`${estaActivo(item) ? 'Desactivar' : 'Activar'} a ${item.nombre}`} disabled={cambiandoEstado === item.id_usuario || (estaActivo(item) && Number(item.id_usuario) === miId)} onClick={() => cambiarEstado(item)} className={`grid h-9 w-9 place-items-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-35 ${estaActivo(item) ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
        {cambiandoEstado === item.id_usuario ? <Loader2 size={16} className="animate-spin"/> : estaActivo(item) ? <PowerOff size={16}/> : <Power size={16}/>}
      </button>
    </div>
  );

  if (!administrador) return (
    <div className="rounded-3xl border border-[#F5D5E0] bg-white p-8 text-center">
      <LockKeyhole size={33} className="mx-auto text-[#FC4D84]"/>
      <h2 className="mt-3 text-xl font-bold text-[#302730]">Acceso restringido</h2>
      <p className="mt-2 text-sm text-[#937B87]">Esta sección es exclusiva de administradores.</p>
    </div>
  );

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden pb-10 text-[#302730]">
      <style>{`.swal2-container { z-index: 20000 !important; }`}</style>
      <section className="relative overflow-hidden rounded-[2rem] border border-[#F1DCE4] bg-white p-5 shadow-[0_14px_40px_rgba(70,35,52,.04)] sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#FC4D84]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-[30%] h-24 w-24 rounded-full bg-[#E7AA44]/10 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.22em] text-[#FC4D84]"> LUDAROPE · Administración</span>
              <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Usuarios y accesos<span className="text-[#FC4D84]">.</span></h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#947B87]">Administra al equipo de venta, asigna sucursales y controla quién puede ingresar al sistema.</p>
            </div>
          </div>
          <button type="button" onClick={abrirNuevo} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#FC4D84] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(252,77,132,.22)] transition hover:-translate-y-0.5 hover:bg-[#DF3A70]"><UserPlus size={18}/> Nuevo usuario</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaKpi titulo="Total de usuarios" valor={contadores.total} descripcion="Cuentas del sistema" Icono={Users}/>
        <TarjetaKpi titulo="Administradores" valor={contadores.admins} descripcion="Gestión y configuración" Icono={ShieldCheck} color="oro"/>
        <TarjetaKpi titulo="Cajeros" valor={contadores.cajeros} descripcion="Personal de venta" Icono={UserRound} color="naranja"/>
        <TarjetaKpi titulo="Cuentas activas" valor={contadores.activos} descripcion="Acceso habilitado" Icono={BadgeCheck} color="verde"/>
      </section>

      <section className="rounded-[1.75rem] border border-[#F2DFE6] bg-[#FFF9FB] p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_170px_170px_auto]">
          <div className="relative min-w-0">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#FC4D84]"/>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar nombre, usuario, correo o sucursal..." aria-label="Buscar usuarios" className={`${control} pl-12`} />
          </div>
          <select value={filtroRol} onChange={(e)=>setFiltroRol(e.target.value)} aria-label="Filtrar por rol" className={control}>
            <option value="TODOS">Todos los roles</option>
            <option value="ADMIN">Administrador</option>
            <option value="CAJERO">Cajero</option>
          </select>
          <select value={filtroEstado} onChange={(e)=>setFiltroEstado(e.target.value)} aria-label="Filtrar por estado" className={control}>
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVOS">Activos</option>
            <option value="INACTIVOS">Inactivos</option>
          </select>
          <button type="button" onClick={cargar} disabled={cargando} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#F0CDDA] bg-white px-5 py-3 text-sm font-bold text-[#CC4071] transition hover:bg-[#FFF0F5] disabled:opacity-50">
            <RefreshCw size={17} className={cargando ? 'animate-spin' : ''}/> Actualizar
          </button>
        </div>
      </section>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} className="shrink-0"/> {error}</div>}

      <section className="overflow-hidden rounded-[1.8rem] border border-[#F1E0E6] bg-white shadow-[0_14px_40px_rgba(70,35,52,.035)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#F3E4E9] px-5 py-5 sm:px-6">
          <div>
            <h2 className="font-serif text-xl font-semibold">Personal con acceso</h2>
            <p className="mt-1 text-xs text-[#9B8590]">{listaFiltrada.length} resultado(s)</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3 py-2 text-[11px] font-extrabold text-[#C73D6E]"><ShieldCheck size={14}/> ADMIN / CAJERO</div>
        </div>

        {cargando ? <div className="flex items-center justify-center gap-2 p-16 text-sm text-[#A38A95]"><Loader2 className="animate-spin" size={20}/> Cargando usuarios...</div>
          : listaFiltrada.length === 0 ? <div className="p-14 text-center"><UserCog size={32} className="mx-auto text-[#FC4D84]"/><p className="mt-3 font-semibold">No se encontraron usuarios.</p><p className="mt-1 text-sm text-[#A38A95]">Prueba otra búsqueda o crea un usuario.</p></div>
            : <>
              <div className="space-y-3 p-4 lg:hidden">
                {listaFiltrada.map((item) => <article key={item.id_usuario} className="rounded-[1.4rem] border border-[#F2E2E8] bg-[#FFFCFD] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#FC4D84]"><UserRound size={20}/></span><div className="min-w-0"><p className="break-words font-extrabold">{item.nombre}</p><p className="mt-1 text-xs text-[#9E8791]">@{item.usuario}</p></div></div>
                    <Estado valor={item.activo}/>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2"><Rol valor={item.rol}/></div>
                  <div className="mt-3 space-y-2 text-xs text-[#7D6874]"><p className="flex items-center gap-2"><Store size={14}/>{item.sucursal || (rolNormalizado(item) === 'ADMIN' ? 'Administración general' : 'Sin sucursal')}</p><p className="flex items-center gap-2 break-all"><Mail size={14}/>{item.correo || 'Sin correo registrado'}</p><p className="flex items-center gap-2"><CalendarDays size={14}/>{formatoFecha(item.fecha_creacion)}</p></div>
                  <div className="mt-3 border-t border-[#F3E5EA] pt-3"><Acciones item={item}/></div>
                </article>)}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1010px]"><thead className="border-b border-[#F1E5E9] bg-[#FFFAFB]"><tr><Encabezado>Usuario</Encabezado><Encabezado>Rol</Encabezado><Encabezado>Sucursal</Encabezado><Encabezado>Correo</Encabezado><Encabezado>Estado</Encabezado><Encabezado>Alta</Encabezado><Encabezado>Acciones</Encabezado></tr></thead>
                  <tbody className="divide-y divide-[#F4E9ED]">{listaFiltrada.map((item) => <tr key={item.id_usuario} className="transition hover:bg-[#FFF9FB]">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#FC4D84]"><UserRound size={19}/></span><div className="min-w-0"><p className="max-w-[200px] truncate text-sm font-extrabold">{item.nombre}</p><p className="mt-1 text-xs text-[#A18A94]">@{item.usuario}</p></div></div></td>
                    <td className="px-5 py-4"><Rol valor={item.rol}/></td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#745E6A]"><span className="inline-flex items-center gap-1.5"><Store size={14} className="shrink-0 text-[#FE714B]"/>{item.sucursal || (rolNormalizado(item) === 'ADMIN' ? 'Administración general' : '—')}</span></td>
                    <td className="max-w-[220px] truncate px-5 py-4 text-sm text-[#896F7C]">{item.correo || '—'}</td>
                    <td className="px-5 py-4"><Estado valor={item.activo}/></td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[#927C87]">{formatoFecha(item.fecha_creacion)}</td>
                    <td className="px-5 py-4"><Acciones item={item}/></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>}
      </section>

      {modal && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6" role="presentation">
        <button type="button" aria-label="Cerrar formulario" className="absolute inset-0 bg-[#24151F]/65 backdrop-blur-sm" disabled={guardando} onClick={cerrar}/>
        <section role="dialog" aria-modal="true" aria-labelledby="titulo-usuario" className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-[#F3DCE5] bg-white shadow-[0_35px_100px_rgba(37,20,31,.32)]">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#F2E3E9] px-5 py-5 sm:px-7">
            <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#FC4D84]">Administración de usuarios</p><h2 id="titulo-usuario" className="mt-2 font-serif text-2xl font-semibold">{seleccionado ? 'Editar usuario' : 'Nuevo usuario'}<span className="text-[#FC4D84]">.</span></h2><p className="mt-1 text-sm text-[#99818C]">Configura su acceso y la sucursal correspondiente.</p></div>
            <button type="button" onClick={cerrar} disabled={guardando} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0F5] text-[#C84070] transition hover:bg-[#FCE0EA] disabled:opacity-40" aria-label="Cerrar"><X size={20}/></button>
          </div>
          <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-extrabold text-[#69535F]">Nombre completo *
                  <input name="nombre" value={form.nombre} onChange={cambiar} maxLength={150} required placeholder="Nombre y apellido" className={`${control} mt-2`}/>
                </label>
                <label className="block text-xs font-extrabold text-[#69535F]">Usuario de acceso *
                  <input name="usuario" value={form.usuario} onChange={cambiar} maxLength={60} required placeholder="Ej. caja.principal" autoComplete="username" className={`${control} mt-2`}/>
                </label>
                <label className="block text-xs font-extrabold text-[#69535F]">Correo electrónico (opcional)
                  <input type="email" name="correo" value={form.correo} onChange={cambiar} maxLength={254} placeholder="correo@ejemplo.com" autoComplete="email" className={`${control} mt-2`}/>
                </label>
                <label className="block text-xs font-extrabold text-[#69535F]">Contraseña {seleccionado ? '(opcional)' : '*'}
                  <div className="relative mt-2">
                    <input type={verPassword ? 'text' : 'password'} name="password" value={form.password} onChange={cambiar} placeholder={seleccionado ? 'Sin cambios si queda vacío' : 'Mínimo 8 caracteres'} autoComplete="new-password" className={`${control} pr-12`}/>
                    <button type="button" onClick={()=>setVerPassword(v=>!v)} title={verPassword?'Ocultar contraseña':'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#A88B98] hover:text-[#FC4D84]">{verPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                  </div>
                </label>
                <label className="block text-xs font-extrabold text-[#69535F]">Rol *
                  <select name="rol" value={form.rol} onChange={cambiar} disabled={seleccionado && Number(seleccionado.id_usuario) === miId} className={`${control} mt-2`}>
                    <option value="CAJERO">Cajero</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </label>
                <label className="block text-xs font-extrabold text-[#69535F]">Sucursal {form.rol === 'CAJERO' ? '*' : '(opcional)'}
                  <select name="id_sucursal" value={form.id_sucursal} onChange={cambiar} required={form.rol === 'CAJERO'} className={`${control} mt-2`}>
                    <option value="">{form.rol === 'ADMIN' ? 'Administración general' : 'Selecciona una sucursal'}</option>
                    {sucursales.map((s) => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}
                  </select>
                </label>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-[#F3E1E8] bg-[#FFF8FA] px-4 py-4">
                <KeyRound size={19} className="mt-0.5 shrink-0 text-[#FC4D84]"/>
                <div><p className="text-sm font-extrabold text-[#483740]">Permisos y seguridad</p><p className="mt-1 text-xs leading-relaxed text-[#927D87]">Los administradores gestionan el sistema; los cajeros operan exclusivamente en su sucursal y no tienen acceso a costos de compra. Al editar, deja la contraseña vacía para conservarla.</p></div>
              </div>
              {seleccionado && <div className="flex items-start gap-3 rounded-xl bg-[#FFF7E8] px-4 py-3 text-xs text-[#906727]"><AlertCircle size={16} className="shrink-0"/><span>Para activar o desactivar la cuenta, utiliza el botón de estado del listado. Las cajas asignadas o las sesiones abiertas pueden impedir cambios de sucursal o rol.</span></div>}
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#F1E2E8] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button type="button" onClick={cerrar} disabled={guardando} className="rounded-xl bg-[#F8F0F3] px-6 py-3 text-sm font-bold text-[#806775] transition hover:bg-[#F2E1E8]">Cancelar</button>
              <button type="submit" disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-6 py-3 text-sm font-extrabold text-white shadow-[0_9px_20px_rgba(252,77,132,.19)] transition hover:bg-[#E23D72] disabled:opacity-55">{guardando ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} {guardando ? 'Guardando...' : seleccionado ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </form>
        </section>
      </div>, document.body)}
    </div>
  );
}
