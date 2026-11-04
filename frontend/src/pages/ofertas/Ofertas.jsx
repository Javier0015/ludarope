import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { BadgePercent, CalendarClock, CheckCircle2, Edit3, Loader2, Plus, RefreshCw, Search, Sparkles, Tags, X } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const input = 'w-full rounded-xl border border-[#EED8E1] bg-white px-3 py-3 text-sm font-semibold text-[#463640] outline-none focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10';
const etiqueta = 'mb-1.5 block text-xs font-extrabold text-[#735B69]';
const formato = n => Number(n || 0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
// Quitar ceros decimales innecesarios: 20.00 -> 20; 12.50 -> 12,5.
const formatoPorcentaje = n => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
function localInput(d) {
  const value = new Date(d); const to = n => String(n).padStart(2,'0');
  return `${value.getFullYear()}-${to(value.getMonth()+1)}-${to(value.getDate())}T${to(value.getHours())}:${to(value.getMinutes())}`;
}
function inicial() {
  const ahora=Date.now();
  return {nombre:'',descripcion:'',tipo:'PORCENTAJE',alcance:'PRENDAS',porcentaje:'15',precio_especial:'',lleva_n:3,paga_m:2,
    combinar_prendas:true,prioridad:0,fecha_inicio:localInput(ahora),fecha_fin:localInput(ahora+14*86400000),
    activa:true,prendas_ids:[],categorias_ids:[],sucursales_ids:[]};
}
function fechaLocal(value) {return new Date(value).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});}
function resumenRegla(p) {
  if(p.tipo==='PORCENTAJE')return `${formatoPorcentaje(p.porcentaje)}% de descuento`;
  if(p.tipo==='PRECIO_ESPECIAL')return `Precio especial ${formato(p.precio_especial)}`;
  return `${p.lleva_n}×${p.paga_m}${p.combinar_prendas?' · Mezclar prendas':''}`;
}
function estado(p) {
  const now=Date.now();
  return !p.activa ? ['Pausada','bg-gray-100 text-gray-600'] : now < +new Date(p.fecha_inicio) ? ['Programada','bg-amber-100 text-amber-800'] : now >= +new Date(p.fecha_fin) ? ['Finalizada','bg-gray-100 text-gray-600'] : ['Vigente','bg-emerald-100 text-emerald-700'];
}
function Seleccion({ titulo, opciones, ids, llave, onToggle, buscar }) {
  const visibles = opciones.filter(o => String(o.nombre).toLowerCase().includes(buscar.toLowerCase())).slice(0,100);
  return <div className="rounded-xl border border-[#F0DEE5] bg-[#FFF9FB] p-3">
    <p className="mb-2 text-xs font-extrabold text-[#604856]">{titulo} · {ids.length} seleccionada(s)</p>
    <div className="max-h-44 space-y-1 overflow-y-auto">
      {visibles.map(o=><label key={o[llave]} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-xs hover:bg-white">
        <input type="checkbox" checked={ids.map(Number).includes(Number(o[llave]))} onChange={()=>onToggle(o[llave])} className="accent-[#FC4D84]"/>
        <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
      </label>)}
      {!visibles.length&&<p className="text-xs text-[#A08995]">Sin coincidencias.</p>}
    </div>
  </div>;
}
export default function Ofertas() {
  const {usuario} = useAuth();
  const rol=String(usuario?.rol||'').trim().toUpperCase();
  const admin=rol==='ADMIN';
  const permitido=['ADMIN','CAJERO'].includes(rol);
  const idSucursalPropia=Number(usuario?.id_sucursal||0);
  const [promociones,setPromociones]=useState([]);
  const [opciones,setOpciones]=useState({prendas:[],categorias:[],sucursales:[]});
  const [editar,setEditar]=useState(false);
  const [form,setForm]=useState(inicial);
  const [filtro,setFiltro]=useState('');
  const [busquedaOpciones,setBusquedaOpciones]=useState('');
  const [guardando,setGuardando]=useState(false);
  const [cargando,setCargando]=useState(false);
  const cambio=(k,v)=>setForm(f=>({...f,[k]:v}));
  const alternar=(k,x)=>setForm(f=>({...f,[k]:f[k].map(Number).includes(Number(x))?f[k].filter(id=>Number(id)!==Number(x)):[...f[k],Number(x)]}));
  const cargar=useCallback(async()=>{
    if(!permitido)return;
    setCargando(true);
    try {
      const [a,b]=await Promise.all([api.get('/promociones'),api.get('/promociones/opciones')]);
      setPromociones(a.data.promociones||[]);setOpciones({prendas:b.data.prendas||[],categorias:b.data.categorias||[],sucursales:b.data.sucursales||[]});
    }catch(e){Swal.fire('Error',e.response?.data?.mensaje||'No se pudieron cargar las ofertas','error');}
    finally{setCargando(false);}
  },[permitido]);
  useEffect(()=>{cargar();},[cargar]);
  const lista=useMemo(()=>promociones.filter(p=>`${p.nombre} ${resumenRegla(p)}`.toLowerCase().includes(filtro.toLowerCase())),[promociones,filtro]);
  function comenzar(p) {
    if(!admin && p && p.puede_editar!==true) {
      return Swal.fire('Solo lectura','Esta promoción es global o incluye otras sucursales; solo ADMIN puede modificarla.','info');
    }
    const base=p?{...p,porcentaje:p.porcentaje == null ? '15' : String(Number(p.porcentaje)),precio_especial:p.precio_especial??'',
      fecha_inicio:localInput(p.fecha_inicio),fecha_fin:localInput(p.fecha_fin),
      prendas_ids:(p.prendas_ids||[]).map(Number),categorias_ids:(p.categorias_ids||[]).map(Number),
      sucursales_ids:(p.sucursales_ids||[]).map(Number)}:inicial();
    // CAJERO nunca crea promociones generales: siempre aplica únicamente a su sucursal.
    if(!admin) base.sucursales_ids=[idSucursalPropia];
    setForm(base);
    setBusquedaOpciones('');setEditar(true);
  }
  async function guardar(e) {
    e.preventDefault();
    if(!admin && !idSucursalPropia)return Swal.fire('Sucursal no disponible','La cuenta no tiene sucursal activa asignada.','warning');
    if(form.tipo==='NXM' && !(Number(form.lleva_n)>Number(form.paga_m)&&Number(form.paga_m)>=1))return Swal.fire('Promoción inválida','N debe ser mayor que M','warning');
    if(form.alcance==='PRENDAS'&&!form.prendas_ids.length || form.alcance==='CATEGORIAS'&&!form.categorias_ids.length)
      return Swal.fire('Selecciona participantes','Selecciona al menos una prenda o categoría','warning');
    setGuardando(true);
    try {
      const payload={...form,sucursales_ids:admin?form.sucursales_ids:[idSucursalPropia],fecha_inicio:new Date(form.fecha_inicio).toISOString(),fecha_fin:new Date(form.fecha_fin).toISOString()};
      if(form.id_promocion)await api.put(`/promociones/${form.id_promocion}`,payload);
      else await api.post('/promociones',payload);
      setEditar(false);await cargar();
      Swal.fire({icon:'success',title:'Promoción guardada',timer:1300,showConfirmButton:false});
    }catch(e){Swal.fire('No se guardó',e.response?.data?.mensaje||'Revisa los valores ingresados','error');}
    finally{setGuardando(false);}
  }
  async function cambiarEstado(p) {
    if(!admin && p.puede_editar!==true)return Swal.fire('Solo lectura','Solo ADMIN puede cambiar el estado de una promoción global o multisucursal.','info');
    const r=await Swal.fire({title:p.activa?'¿Pausar oferta?':'¿Activar oferta?',text:p.nombre,showCancelButton:true,confirmButtonText:'Confirmar',confirmButtonColor:'#FC4D84'});
    if(!r.isConfirmed)return;
    try{await api.patch(`/promociones/${p.id_promocion}/estado`,{activa:!p.activa});await cargar();}
    catch(e){Swal.fire('Error',e.response?.data?.mensaje||'No se pudo actualizar','error');}
  }
  if(!permitido)return <div className="rounded-xl bg-white p-8 text-rose-700">No tienes permiso para consultar promociones.</div>;
  return <main className="min-w-0 space-y-5 pb-12 text-[#342A32]">
    <header className="relative overflow-hidden rounded-[1.9rem] border border-[#F2DDE6] bg-gradient-to-br from-white via-[#FFF8FB] to-[#FFF0EA] p-5 shadow-sm sm:p-7">
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div><p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.2em] text-[#FC4D84]"> LUDAROPE · Ventas y caja</p><h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Ofertas y promociones<span className="text-[#FC4D84]">.</span></h1><p className="mt-2 text-sm text-[#927A85]">Crea reglas dinámicas que se aplican automáticamente en el POS y el catálogo.</p></div>
        <button onClick={()=>comenzar(null)} className="flex items-center gap-2 rounded-xl bg-[#FC4D84] px-5 py-3.5 text-sm font-black text-white shadow-sm hover:bg-[#E63B71]"><Plus size={17}/> Nueva oferta</button>
      </div>
    </header>
    <section className="grid gap-3 sm:grid-cols-3">
      {[['Ofertas registradas',promociones.length],['Vigentes',promociones.filter(p=>estado(p)[0]==='Vigente').length],['Programadas',promociones.filter(p=>estado(p)[0]==='Programada').length]].map(([nombre,cantidad])=><div key={nombre} className="rounded-2xl border border-[#F1E0E7] bg-white p-5"><p className="text-xs text-[#987D8B]">{nombre}</p><p className="mt-2 text-2xl font-black">{cantidad}</p></div>)}
    </section>
    <section className="rounded-[1.6rem] border border-[#F1E0E7] bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2"><Tags className="text-[#FC4D84]" size={19}/><h2 className="font-black">Promociones registradas</h2><button onClick={cargar} className="ml-auto rounded-lg border border-[#F1DEE5] p-2 text-[#FC4D84]" title="Actualizar"><RefreshCw size={17} className={cargando?'animate-spin':''}/></button></div>
      <label className="mb-4 flex items-center gap-2 rounded-xl border border-[#EFDBE3] px-3"><Search size={17} className="text-[#FC4D84]"/><input placeholder="Buscar promoción..." className="w-full py-3 text-sm outline-none" value={filtro} onChange={e=>setFiltro(e.target.value)}/></label>
      <div className="space-y-3">{lista.map(p=>{
        const [nombreEstado,clase]=estado(p);
        return <article key={p.id_promocion} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#F0E0E7] bg-[#FFFCFD] p-4">
          <div className="rounded-xl bg-[#FFF0F5] p-3 text-[#FC4D84]"><BadgePercent size={21}/></div>
          <div className="min-w-[180px] flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{p.nombre}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${clase}`}>{nombreEstado}</span></div><p className="mt-1 text-sm font-bold text-[#C84674]">{resumenRegla(p)}</p><p className="mt-1 text-xs text-[#99848E]">{fechaLocal(p.fecha_inicio)} a {fechaLocal(p.fecha_fin)} · {p.alcance.toLowerCase()} · prioridad {p.prioridad}</p></div>
          {(admin||p.puede_editar===true)
            ? <div className="flex gap-2"><button type="button" onClick={()=>comenzar(p)} className="flex items-center gap-1 rounded-xl border border-[#F1D8E1] px-3 py-2 text-xs font-bold text-[#C43D6E]"><Edit3 size={15}/> Editar</button><button type="button" onClick={()=>cambiarEstado(p)} className="rounded-xl bg-[#FFF0F5] px-3 py-2 text-xs font-bold text-[#B9426C]">{p.activa?'Pausar':'Activar'}</button></div>
            : <span className="rounded-xl bg-[#F5F0F2] px-3 py-2 text-xs font-bold text-[#8A7380]">Solo lectura · Promoción general</span>}
        </article>;
      })}{!lista.length&&<p className="p-8 text-center text-sm text-[#947D87]">No hay promociones que coincidan.</p>}</div>
    </section>
    {editar&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#24151E]/65 p-2 sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setEditar(false);}}>
      <section role="dialog" aria-modal="true" aria-label="Editar oferta" className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#F1DEE5] bg-[#FFF8FB] p-5"><div><p className="text-xs font-black uppercase tracking-widest text-[#FC4D84]">Ofertas LUDAROPE</p><h2 className="mt-1 font-serif text-2xl font-bold">{form.id_promocion?'Editar promoción':'Nueva promoción'}</h2></div><button onClick={()=>setEditar(false)} aria-label="Cerrar" className="rounded-xl p-2 text-[#A4778B]"><X size={20}/></button></header>
        <form onSubmit={guardar} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2"><label><span className={etiqueta}>Nombre de promoción</span><input required maxLength={140} value={form.nombre} onChange={e=>cambio('nombre',e.target.value)} className={input} placeholder="Ej. Lleva 3 y paga 2"/></label><label><span className={etiqueta}>Tipo</span><select value={form.tipo} onChange={e=>cambio('tipo',e.target.value)} className={input}><option value="PORCENTAJE">Porcentaje</option><option value="PRECIO_ESPECIAL">Precio especial</option><option value="NXM">Lleva N y paga M</option></select></label></div>
          <label className="block"><span className={etiqueta}>Descripción opcional</span><input maxLength={500} value={form.descripcion||''} onChange={e=>cambio('descripcion',e.target.value)} className={input}/></label>
          {form.tipo==='PORCENTAJE'?<label className="block"><span className={etiqueta}>Descuento (%)</span><input type="number" required min="0.01" max="99.99" step="0.01" value={form.porcentaje} onChange={e=>cambio('porcentaje',e.target.value)} className={input}/></label>:form.tipo==='PRECIO_ESPECIAL'?<label className="block"><span className={etiqueta}>Precio final por unidad ($)</span><input type="number" required min="0.01" step="0.01" value={form.precio_especial} onChange={e=>cambio('precio_especial',e.target.value)} className={input}/></label>:<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><label><span className={etiqueta}>Prendas que lleva (N)</span><input type="number" min="2" max="20" step="1" value={form.lleva_n} onChange={e=>cambio('lleva_n',e.target.value)} className={input}/></label><label><span className={etiqueta}>Prendas que paga (M)</span><input type="number" min="1" max="19" step="1" value={form.paga_m} onChange={e=>cambio('paga_m',e.target.value)} className={input}/></label></div><label className="flex items-center gap-3 rounded-xl bg-[#FFF0F5] p-3 text-xs font-bold"><input type="checkbox" checked={form.combinar_prendas} onChange={e=>cambio('combinar_prendas',e.target.checked)} className="accent-[#FC4D84]"/> Permitir combinar prendas diferentes (gratis las más económicas de cada grupo)</label></div>}
          <div className="grid gap-4 sm:grid-cols-2"><label><span className={etiqueta}>Inicio de vigencia</span><input type="datetime-local" required value={form.fecha_inicio} onChange={e=>cambio('fecha_inicio',e.target.value)} className={input}/></label><label><span className={etiqueta}>Fin de vigencia</span><input type="datetime-local" required value={form.fecha_fin} onChange={e=>cambio('fecha_fin',e.target.value)} className={input}/></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label><span className={etiqueta}>Alcance</span><select className={input} value={form.alcance} onChange={e=>cambio('alcance',e.target.value)}><option value="PRENDAS">Prendas seleccionadas</option><option value="CATEGORIAS">Categorías seleccionadas</option><option value="TODAS">Toda la colección</option></select></label><label><span className={etiqueta}>Prioridad (mayor se aplica primero)</span><input type="number" step="1" min="-10000" max="10000" className={input} value={form.prioridad} onChange={e=>cambio('prioridad',e.target.value)}/></label></div>
          {form.alcance!=='TODAS'&&<><label className="block"><span className={etiqueta}>Buscar participantes</span><input value={busquedaOpciones} onChange={e=>setBusquedaOpciones(e.target.value)} className={input} placeholder="Filtrar por nombre"/></label><Seleccion titulo={form.alcance==='PRENDAS'?'Prendas':'Categorías'} opciones={form.alcance==='PRENDAS'?opciones.prendas:opciones.categorias} ids={form.alcance==='PRENDAS'?form.prendas_ids:form.categorias_ids} llave={form.alcance==='PRENDAS'?'id_prenda':'id_categoria'} onToggle={x=>alternar(form.alcance==='PRENDAS'?'prendas_ids':'categorias_ids',x)} buscar={busquedaOpciones}/></>}
          {admin
            ? <Seleccion titulo="Sucursales (ninguna seleccionada = todas)" opciones={opciones.sucursales} ids={form.sucursales_ids} llave="id_sucursal" onToggle={x=>alternar('sucursales_ids',x)} buscar=""/>
            : <div className="rounded-xl border border-[#F0DEE5] bg-[#FFF9FB] p-4 text-xs font-semibold text-[#735B69]">La promoción se aplicará exclusivamente a <strong>{opciones.sucursales[0]?.nombre||usuario?.sucursal||'tu sucursal asignada'}</strong>.</div>}
          <label className="flex items-center gap-3 rounded-xl border border-[#F0DEE5] p-3 text-sm font-bold"><input type="checkbox" checked={form.activa} onChange={e=>cambio('activa',e.target.checked)} className="accent-[#FC4D84]"/> Oferta habilitada (su aplicación respeta las fechas)</label>
          <div className="rounded-xl bg-[#FFF9F0] p-3 text-xs leading-6 text-[#9C713B]">Las promociones no se acumulan sobre una misma unidad. El cálculo real se realiza de nuevo al cobrar; los precios originales permanecen intactos.</div>
          <button type="submit" disabled={guardando} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-5 py-4 text-sm font-black text-white disabled:opacity-60">{guardando?<Loader2 size={19} className="animate-spin"/>:<CheckCircle2 size={19}/>} Guardar promoción</button>
        </form>
      </section>
    </div>}
  </main>;
}
