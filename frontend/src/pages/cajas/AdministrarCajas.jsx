import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { CheckCircle2, CircleOff, Edit3, Loader2, Plus, RefreshCw, Search, ShieldCheck, Store, Users, Wallet, X } from 'lucide-react';
import api from '../../api/axios';

const VACIO = { id_sucursal: '', nombre: '', descripcion: '', id_usuario_asignado: '', activo: true };
const campo = 'w-full min-w-0 rounded-xl border border-[#EBD5DE] bg-white px-4 py-3 text-sm text-[#3F3039] outline-none focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10';
const etiqueta = 'mb-2 block text-xs font-extrabold uppercase tracking-[.10em] text-[#947984]';
const txtError = (e) => e.response?.data?.mensaje || 'No se pudo completar la operación.';

function Resumen({ icono: Icono, titulo, valor, tono }) {
  return <div className="rounded-2xl border border-[#F1E0E7] bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-[#9A7F8B]">{titulo}</p><span className={`rounded-xl p-2 ${tono}`}><Icono size={20}/></span></div><p className="mt-2 font-serif text-3xl font-semibold text-[#372A32]">{valor}</p></div>;
}

export default function AdministrarCajas() {
  const [sucursales, setSucursales] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [cajeros, setCajeros] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modal, setModal] = useState(false);
  const [edicion, setEdicion] = useState(null);
  const [form, setForm] = useState(VACIO);

  const cargarSucursales = useCallback(async () => {
    try {
      const { data } = await api.get('/pos/sucursales');
      const lista = data.sucursales || [];
      setSucursales(lista);
    } catch(e) { Swal.fire('Error',txtError(e),'error'); }
  }, []);
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/admin/cajas', { params: { ...(filtro ? { id_sucursal: filtro } : {}), buscar } });
      setCajas(data.cajas || []);
    } catch(e) { Swal.fire('Error',txtError(e),'error'); }
    finally { setCargando(false); }
  }, [filtro,buscar]);
  useEffect(() => { cargarSucursales(); }, [cargarSucursales]);
  useEffect(() => { const t=setTimeout(cargar, 220);return ()=>clearTimeout(t); }, [cargar]);
  useEffect(() => {
    if (!modal || !form.id_sucursal) { setCajeros([]); return undefined; }
    let vigente = true;
    api.get('/admin/cajas/cajeros', { params:{ id_sucursal: form.id_sucursal }})
      .then(({ data }) => { if (vigente) setCajeros(data.cajeros || []); })
      .catch(() => { if(vigente) setCajeros([]); });
    return ()=>{vigente=false;};
  }, [modal, form.id_sucursal]);

  const resumen=useMemo(()=>({total:cajas.length,activas:cajas.filter(c=>c.activo).length,inactivas:cajas.filter(c=>!c.activo).length,ocupadas:cajas.filter(c=>c.sesion_abierta).length}),[cajas]);
  const abrirNuevo=()=>{setEdicion(null);setForm({...VACIO,id_sucursal:filtro||String(sucursales[0]?.id_sucursal||'')});setModal(true);};
  const abrirEditar=(c)=>{setEdicion(c);setForm({id_sucursal:String(c.id_sucursal),nombre:c.nombre,descripcion:c.descripcion||'',id_usuario_asignado:String(c.id_usuario_asignado||''),activo:!!c.activo});setModal(true);};
  const cerrar=()=>{setModal(false);setEdicion(null);setForm(VACIO);};
  const cambiar=(nombre,valor)=>setForm(x=>({...x,[nombre]:valor,...(nombre==='id_sucursal'?{id_usuario_asignado:''}:{})}));

  const guardar=async(e)=>{
    e.preventDefault();
    if(!form.id_sucursal||!form.nombre.trim())return Swal.fire('Faltan datos','Indica sucursal y nombre de la caja.','warning');
    setGuardando(true);
    try {
      const body={ id_sucursal:Number(form.id_sucursal), nombre:form.nombre.trim(),descripcion:form.descripcion.trim(), id_usuario_asignado:form.id_usuario_asignado?Number(form.id_usuario_asignado):null,activo:form.activo };
      if(edicion)await api.put(`/admin/cajas/${edicion.id_caja}`,body);
      else await api.post('/admin/cajas',body);
      setGuardando(false);cerrar();await cargar();
      Swal.fire({icon:'success',title:edicion?'Caja actualizada':'Caja creada',timer:1500,showConfirmButton:false});
    } catch(e) { Swal.fire('No se pudo guardar',txtError(e),'error'); }
    finally {setGuardando(false);}
  };
  const cambiarEstado=async(c)=>{
    const accion=c.activo?'desactivar':'activar';
    const resp=await Swal.fire({title:`¿${accion[0].toUpperCase()+accion.slice(1)} ${c.nombre}?`,text:c.sesion_abierta?'Tiene una sesión abierta: ciérrala primero.':`Se ${c.activo?'retirará':'restaurará'} la disponibilidad para cobrar.`,icon:'question',showCancelButton:true,confirmButtonText:'Sí, continuar',confirmButtonColor:'#FC4D84'});
    if(!resp.isConfirmed)return;
    try{await api.patch(`/admin/cajas/${c.id_caja}/estado`,{activo:!c.activo});await cargar();}
    catch(e){Swal.fire('No se pudo cambiar el estado',txtError(e),'error');}
  };
  return (
    <div className="min-w-0 space-y-5 pb-8 text-[#352B32]">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#F1E0E7] bg-white p-5 shadow-[0_12px_40px_rgba(78,35,55,.05)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[#FC4D84]/10 blur-3xl"/>
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex gap-4">
            <div><p className="text-[11px] font-black uppercase tracking-[.22em] text-[#FC4D84]">LUDAROPE · Administración</p><h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Configuración de cajas<span className="text-[#FC4D84]">.</span></h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#9A818E]">Crea cajas por sucursal, asigna un cajero y controla cuáles están disponibles para operar.</p></div>
          </div>
          <button type="button" onClick={abrirNuevo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(252,77,132,.2)] hover:bg-[#E53E74]"><Plus size={19}/> Nueva caja</button>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-[minmax(190px,260px)_1fr_auto]">
          <select aria-label="Filtrar por sucursal" value={filtro} onChange={e=>setFiltro(e.target.value)} className={campo}><option value="">Todas las sucursales</option>{sucursales.map(s=><option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}</select>
          <div className="flex items-center rounded-xl border border-[#EBD5DE] bg-white px-3 focus-within:border-[#FC4D84]"><Search size={18} className="text-[#FC4D84]"/><input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar caja, descripción o cajero..." className="min-w-0 w-full px-3 py-3 text-sm outline-none"/></div>
          <button type="button" onClick={cargar} className="flex items-center justify-center gap-2 rounded-xl bg-[#302730] px-4 py-3 text-sm font-bold text-white hover:bg-[#443641]"><RefreshCw size={17}/> Actualizar</button>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Resumen icono={Wallet} titulo="Cajas" valor={resumen.total} tono="bg-[#FFF0F5] text-[#FC4D84]"/><Resumen icono={CheckCircle2} titulo="Activas" valor={resumen.activas} tono="bg-emerald-50 text-emerald-600"/><Resumen icono={CircleOff} titulo="Inactivas" valor={resumen.inactivas} tono="bg-amber-50 text-amber-600"/><Resumen icono={ShieldCheck} titulo="En operación" valor={resumen.ocupadas} tono="bg-[#FFF2E8] text-[#FE714B]"/></div>
      <section className="overflow-hidden rounded-[1.65rem] border border-[#F1E0E7] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[#F5E8EE] px-5 py-4"><h2 className="font-serif text-2xl font-semibold">Cajas registradas</h2>{cargando&&<Loader2 size={20} className="animate-spin text-[#FC4D84]"/>}</div>
        <div className="grid gap-3 p-4 md:hidden">{!cargando&&!cajas.length&&<p className="py-8 text-center text-sm text-[#947F89]">No hay cajas registradas.</p>}{cajas.map(c=><article key={c.id_caja} className="rounded-xl border border-[#F1E0E7] p-4"><div className="flex items-start justify-between gap-2"><p className="font-extrabold">{c.nombre}</p><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${c.activo?'bg-emerald-50 text-emerald-700':'bg-[#F1E5EA] text-[#866D7A]'}`}>{c.activo?'Activa':'Inactiva'}</span></div><p className="mt-2 text-xs text-[#947F89]">{c.sucursal} · {c.cajero_asignado||'Sin asignar'}</p><p className="mt-1 text-xs text-[#947F89]">{c.sesion_abierta?'En operación':'Sin sesión abierta'}</p><div className="mt-4 flex gap-2"><button type="button" onClick={()=>abrirEditar(c)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFF0F5] px-4 py-2.5 text-xs font-bold text-[#C83B6B]"><Edit3 size={15}/> Editar</button><button type="button" onClick={()=>cambiarEstado(c)} className="flex-1 rounded-xl border border-[#F1D7E2] px-3 py-2.5 text-xs font-bold">{c.activo?'Desactivar':'Activar'}</button></div></article>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="min-w-[750px] w-full text-left"><thead className="bg-[#FFF8FB] text-[11px] font-extrabold uppercase tracking-wider text-[#907784]"><tr><th className="px-5 py-4">Caja</th><th className="px-5 py-4">Sucursal</th><th className="px-5 py-4">Cajero asignado</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Operación</th><th className="px-5 py-4">Acciones</th></tr></thead><tbody className="divide-y divide-[#F5E8EE]">{!cargando&&!cajas.length&&<tr><td colSpan="6" className="px-5 py-9 text-center text-sm text-[#947F89]">No hay cajas registradas.</td></tr>}{cajas.map(c=><tr key={c.id_caja} className="text-sm hover:bg-[#FFFAFC]"><td className="px-5 py-4"><p className="font-extrabold">{c.nombre}</p><p className="text-xs text-[#9A818C]">{c.descripcion||`Caja #${c.id_caja}`}</p></td><td className="px-5 py-4">{c.sucursal}</td><td className="px-5 py-4">{c.cajero_asignado||'Sin asignar'}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${c.activo?'bg-emerald-50 text-emerald-700':'bg-[#F1E5EA] text-[#866D7A]'}`}>{c.activo?'Activa':'Inactiva'}</span></td><td className="px-5 py-4">{c.sesion_abierta?'Abierta':'Cerrada'}</td><td className="px-5 py-4"><div className="flex gap-2"><button type="button" aria-label={`Editar ${c.nombre}`} title="Editar" onClick={()=>abrirEditar(c)} className="rounded-lg bg-[#FFF0F5] p-2 text-[#C43F6E]"><Edit3 size={17}/></button><button type="button" onClick={()=>cambiarEstado(c)} className="rounded-lg border border-[#F0D6E0] px-3 py-2 text-xs font-bold text-[#A54B70]">{c.activo?'Desactivar':'Activar'}</button></div></td></tr>)}</tbody></table></div>
      </section>
      {modal&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#261823]/65 p-3" role="presentation"><button type="button" aria-label="Cerrar ventana" onClick={cerrar} className="absolute inset-0"/><section role="dialog" aria-modal="true" aria-label="Datos de caja" className="relative w-full max-w-xl overflow-hidden rounded-[1.8rem] bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[#F1E0E7] p-5"><div><p className="text-[11px] font-black uppercase tracking-widest text-[#FC4D84]">LUDAROPE · Caja</p><h2 className="mt-1 font-serif text-2xl font-semibold">{edicion?'Editar caja':'Nueva caja'}</h2></div><button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-xl bg-[#FFF0F5] p-2 text-[#CA3F6E]"><X size={20}/></button></header>
        <form onSubmit={guardar} className="max-h-[80vh] space-y-4 overflow-y-auto p-5"><div><label className={etiqueta}>Sucursal *</label><select disabled={!!edicion} required className={campo} value={form.id_sucursal} onChange={e=>cambiar('id_sucursal',e.target.value)}><option value="">Selecciona sucursal</option>{sucursales.map(s=><option value={s.id_sucursal} key={s.id_sucursal}>{s.nombre}</option>)}</select></div>
          <div><label className={etiqueta}>Nombre de la caja *</label><input className={campo} maxLength={100} required placeholder="Ej. Caja mostrador" value={form.nombre} onChange={e=>cambiar('nombre',e.target.value)}/></div>
          <div><label className={etiqueta}>Descripción</label><textarea className={campo} maxLength={250} rows={2} placeholder="Ubicación o detalle opcional" value={form.descripcion} onChange={e=>cambiar('descripcion',e.target.value)}/></div>
          <div><label className={etiqueta}>Cajero asignado</label><select className={campo} value={form.id_usuario_asignado} onChange={e=>cambiar('id_usuario_asignado',e.target.value)}><option value="">Sin asignar (solo ADMIN podrá operarla)</option>{cajeros.filter(u=>!u.caja_asignada||Number(u.caja_asignada)===Number(edicion?.id_caja)).map(u=><option value={u.id_usuario} key={u.id_usuario}>{u.nombre} ({u.usuario})</option>)}</select><p className="mt-2 text-xs text-[#A18B95]">El cajero debe estar activo y pertenecer a esta sucursal.</p></div>
          <label className="flex items-center gap-3 rounded-xl bg-[#FFF7FA] p-4 text-sm font-bold text-[#594652]"><input type="checkbox" className="h-4 w-4 accent-[#FC4D84]" checked={form.activo} onChange={e=>cambiar('activo',e.target.checked)}/> Caja activa</label>
          <button type="submit" disabled={guardando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-5 py-4 text-sm font-extrabold text-white disabled:opacity-50">{guardando&&<Loader2 size={17} className="animate-spin"/>}{edicion?'Guardar cambios':'Crear caja'}</button>
        </form></section></div>}
    </div>
  );
}
