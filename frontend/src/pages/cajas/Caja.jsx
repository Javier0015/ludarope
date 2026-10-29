import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ArrowDownCircle, ArrowUpCircle, Banknote, Calculator, CheckCircle2, CircleAlert,
  CreditCard, Download, FileText, History, Loader2, LockKeyhole, RefreshCw,
  Save, Store, Wallet, X,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const money = (v) => Number(v || 0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const fecha = (f) => f ? new Date(f).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}) : '—';
const input = 'w-full min-w-0 rounded-xl border border-[#ECD7E0] bg-white px-4 py-3 text-sm font-semibold text-[#40313B] outline-none focus:border-[#FC4D84] focus:ring-4 focus:ring-[#FC4D84]/10';
const denoms = [1000,500,200,100,50,20,10,5,2,1,0.5];
const tipos = [
  ['ENTRADA','Entrada de efectivo'],['SALIDA','Salida de efectivo'],['GASTO','Gasto operativo'],
  ['RETIRO','Retiro de efectivo'],['PAGO_PROVEEDOR','Pago a proveedor'],
  ['AJUSTE_POSITIVO','Ajuste positivo'],['AJUSTE_NEGATIVO','Ajuste negativo'],
];
const mensaje = (e) => e.response?.data?.mensaje || 'Ocurrió un error al realizar la operación.';

function Indicador({titulo,valor,Icono,detalle}) {
  return <div className="min-w-0 rounded-2xl border border-[#F1E0E7] bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-[#977D89]">{titulo}</p><Icono size={18} className="text-[#FC4D84]"/></div><p className="mt-3 break-words font-serif text-[clamp(1.3rem,2.1vw,1.75rem)] font-semibold text-[#332933]">{valor}</p>{detalle&&<p className="mt-1 text-xs text-[#A18B95]">{detalle}</p>}</div>;
}
function Conteo({valor,setValor}) {
  const total=denoms.reduce((s,d)=>s+(Number(valor[String(d)]||0)*d),0);
  return <div className="rounded-2xl border border-[#F0DDE5] bg-[#FFF9FB] p-4"><div className="mb-4 flex items-center gap-2 font-extrabold text-[#59424E]"><Calculator size={18} className="text-[#FC4D84]"/> Conteo de efectivo</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{denoms.map(d=><label key={d} className="rounded-xl border border-[#F1E1E7] bg-white p-2 text-xs"><span className="mb-1 block font-bold text-[#997E8A]">{money(d)}</span><input aria-label={`Cantidad de ${money(d)}`} inputMode="numeric" type="number" min="0" max="100000" step="1" value={valor[String(d)]||''} onChange={e=>setValor(p=>({...p,[String(d)]:e.target.value}))} className="w-full rounded-lg border border-[#EDD8E0] px-3 py-2 text-sm text-[#3B2932] outline-none focus:border-[#FC4D84]"/></label>)}</div><div className="mt-4 flex justify-between rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-bold text-[#C73D70]"><span>Total contado</span><span>{money(total)}</span></div></div>;
}
function Dialogo({titulo,onCerrar,children}) {return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#231620]/65 p-3"><button type="button" onClick={onCerrar} className="absolute inset-0" aria-label="Cerrar ventana"/><section role="dialog" aria-modal="true" aria-label={titulo} className="relative max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[#F1E0E7] px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#FC4D84]">LUDAROPE · Caja</p><h3 className="mt-1 font-serif text-2xl font-semibold">{titulo}</h3></div><button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-xl bg-[#FFF0F5] p-2 text-[#BB3F6D]"><X size={19}/></button></header><div className="space-y-4 p-5">{children}</div></section></div>}

export default function Caja() {
  const { usuario } = useAuth();
  const admin=usuario?.rol==='ADMIN';
  const [sucursales,setSucursales]=useState([]);
  const [sucursal,setSucursal]=useState(admin?'':String(usuario?.id_sucursal||''));
  const [cajas,setCajas]=useState([]);
  const [caja,setCaja]=useState('');
  const [sesion,setSesion]=useState(null);
  const [info,setInfo]=useState(null);
  const [movimientos,setMovimientos]=useState([]);
  const [actividad,setActividad]=useState([]);
  const [diagnostico,setDiagnostico]=useState(null);
  const [historial,setHistorial]=useState([]);
  const [reporte,setReporte]=useState(null);
  const [cargando,setCargando]=useState(false);
  const [guardando,setGuardando]=useState(false);
  const [modal,setModal]=useState('');
  const [inicial,setInicial]=useState('0');
  const [mov,setMov]=useState({tipo:'ENTRADA',concepto:'',monto:'',referencia:'',observaciones:''});
  const [denominaciones,setDenominaciones]=useState({});
  const [contado,setContado]=useState('');
  const [usarConteo,setUsarConteo]=useState(false);
  const [observaciones,setObservaciones]=useState('');
  const cashContado=useMemo(()=>denoms.reduce((s,d)=>s+Number(denominaciones[String(d)]||0)*d,0),[denominaciones]);
  const cajaActual=cajas.find(c=>String(c.id_caja)===caja);
  const resumen=info?.resumen || {};
  const seleccionPermiteOperar=!sesion||admin||Number(sesion.id_usuario)===Number(usuario?.id_usuario);

  useEffect(()=>{api.get('/pos/sucursales').then(({data})=>{const l=data.sucursales||[];setSucursales(l);setSucursal(x=>l.some(s=>String(s.id_sucursal)===x)?x:String(l[0]?.id_sucursal||''));}).catch(e=>Swal.fire('Error',mensaje(e),'error'));},[]);
  useEffect(()=>{
    if(!sucursal){setCajas([]);setCaja('');return undefined;}
    let vivo=true;
    api.get('/caja/cajas',{params:{id_sucursal:sucursal}}).then(({data})=>{if(!vivo)return;const l=data.cajas||[];setCajas(l);setCaja(x=>l.some(c=>String(c.id_caja)===x)?x:String(l[0]?.id_caja||''));}).catch(e=>{if(vivo){setCajas([]);setCaja('');Swal.fire('Error',mensaje(e),'error');}});
    return ()=>{vivo=false;};
  },[sucursal]);

  const cargar=useCallback(async()=>{
    if(!caja){setSesion(null);setInfo(null);setMovimientos([]);setActividad([]);setDiagnostico(null);setHistorial([]);return;}
    setCargando(true);
    try{
      const [{data:s},{data:h}]=await Promise.all([api.get('/caja/sesion-abierta',{params:{id_caja:caja}}),api.get('/caja/historial',{params:{id_caja:caja}})]);
      setSesion(s.sesion_abierta||null);setHistorial(h.sesiones||[]);
      if(s.sesion_abierta){
        const [{data:r},{data:m},{data:a}]=await Promise.all([
          api.get('/caja/resumen',{params:{id_sesion:s.sesion_abierta.id_sesion}}),
          api.get('/caja/movimientos',{params:{id_sesion:s.sesion_abierta.id_sesion}}),
          api.get('/caja/actividad',{params:{id_sesion:s.sesion_abierta.id_sesion}}),
        ]);
        setInfo(r);setMovimientos(m.movimientos||[]);setActividad(a.actividad||[]);setDiagnostico(a.diagnostico||null);
      } else {setInfo(null);setMovimientos([]);setActividad([]);setDiagnostico(null);}
    }catch(e){Swal.fire('No se pudo cargar la caja',mensaje(e),'error');}
    finally{setCargando(false);}
  },[caja]);
  useEffect(()=>{cargar();},[cargar]);

  const abrir=async(e)=>{
    e.preventDefault();setGuardando(true);
    try{await api.post('/caja/abrir',{id_caja:Number(caja),monto_inicial:inicial});setModal('');setInicial('0');await cargar();Swal.fire({icon:'success',title:'Caja abierta',timer:1300,showConfirmButton:false});}
    catch(e){Swal.fire('No se pudo abrir',mensaje(e),'error');}finally{setGuardando(false);}
  };
  const registrar=async(e)=>{
    e.preventDefault();setGuardando(true);
    try{await api.post('/caja/movimiento',{id_sesion:sesion.id_sesion,...mov});setModal('');setMov({tipo:'ENTRADA',concepto:'',monto:'',referencia:'',observaciones:''});await cargar();Swal.fire({icon:'success',title:'Movimiento registrado',timer:1300,showConfirmButton:false});}
    catch(e){Swal.fire('No se pudo registrar',mensaje(e),'error');}finally{setGuardando(false);}
  };
  const cerrar=async(e)=>{
    e.preventDefault();
    const conteo=Object.fromEntries(Object.entries(denominaciones).filter(([,cant])=>cant!==''&&cant!==undefined).map(([den,cant])=>[den,Number(cant)]));
    const real=usarConteo?cashContado:Number(contado);
    if(!Number.isFinite(real)||real<0)return Swal.fire('Importe inválido','Captura efectivo válido.','warning');
    const diferencia=real-Number(resumen.efectivo_esperado||0);
    const confirm=await Swal.fire({title:'¿Cerrar sesión de caja?',html:`Efectivo esperado: <b>${money(resumen.efectivo_esperado)}</b><br>Contado: <b>${money(real)}</b><br>Diferencia: <b>${money(diferencia)}</b>`,icon:'question',showCancelButton:true,confirmButtonColor:'#FC4D84',confirmButtonText:'Confirmar cierre'});
    if(!confirm.isConfirmed)return;
    setGuardando(true);
    try{
      const {data}=await api.post('/caja/cerrar',{id_sesion:sesion.id_sesion,efectivo_contado:real.toFixed(2),observaciones, ...(usarConteo?{conteo_denominaciones:conteo}:{})});
      setModal('');setContado('');setDenominaciones({});setObservaciones('');await cargar();
      Swal.fire({title:'Corte completado',icon:'success',html:`Esperado: <b>${money(data.cierre.efectivo_esperado)}</b><br>Diferencia: <b>${money(data.cierre.diferencia)}</b>`,confirmButtonColor:'#FC4D84'});
    }catch(e){Swal.fire('No se pudo cerrar',mensaje(e),'error');}finally{setGuardando(false);}
  };
  const verReporte=async(s)=>{
    setCargando(true);
    try{const {data}=await api.get('/caja/reporte-cierre',{params:{id_sesion:s.id_sesion}});setReporte(data);setModal('reporte');}
    catch(e){Swal.fire('No se pudo abrir el corte',mensaje(e),'error');}finally{setCargando(false);}
  };
  const descargarPDF=async()=>{
    if(!reporte)return;
    try{
      const {data}=await api.get(`/caja/reporte-cierre/${reporte.sesion.id_sesion}/pdf`,{responseType:'blob'});
      const url=URL.createObjectURL(new Blob([data],{type:'application/pdf'}));
      const a=document.createElement('a');a.href=url;a.download=`LUDAROPE_Corte_${reporte.sesion.id_sesion}.pdf`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){Swal.fire('Error',mensaje(e),'error');}
  };
  const exportarCSV=()=>{
    if(!reporte)return;
    const r=reporte.resumen;
    const filas=[
      ['LUDAROPE · CORTE DIGITAL DE CAJA'],
      ['Sesión',reporte.sesion.id_sesion],['Caja',reporte.sesion.caja],
      ['Sucursal',reporte.sesion.sucursal],['Cajero',reporte.sesion.cajero],
      ['Apertura',fecha(reporte.sesion.fecha_apertura)],['Cierre',fecha(reporte.sesion.fecha_cierre)],
      [],['RESUMEN'],['Fondo inicial',reporte.sesion.monto_inicial],
      ['Ventas completadas',r.numero_ventas],['Venta neta',r.ventas_total],
      ['Efectivo',r.ventas_efectivo],['Débito',r.ventas_debito],['Crédito',r.ventas_credito],
      ['Transferencia',r.ventas_transferencia],['Entradas',r.entradas_efectivo],
      ['Salidas y gastos',r.salidas_efectivo],['Esperado',r.efectivo_esperado],
      ['Contado',r.efectivo_contado],['Diferencia',r.diferencia],[],
      ['VENTAS DEL TURNO'],['Folio','Fecha','Estado','Prendas','Pagos','Importe'],
      ...(reporte.ventas||[]).map(v=>[v.folio,fecha(v.fecha_venta),v.estado,v.prendas,v.pagos,v.total]),[],
      ['CRONOLOGÍA DE MOVIMIENTOS'],['Fecha','Tipo','Folio / referencia','Concepto','Importe','Impacto en efectivo'],
      ...(reporte.actividad||[]).map(a=>[fecha(a.fecha),a.tipo,a.folio,a.concepto,
        (a.importe_signo<0?-1:1)*Number(a.monto),a.impacto_efectivo]),
    ];
    const quote=s=>{
      let v=String(s??'');
      if(/^[\s]*[=+@-]/.test(v))v="'"+v;
      return '"'+v.replaceAll('"','""')+'"';
    };
    const csv='\uFEFF'+filas.map(f=>f.map(quote).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=`LUDAROPE_Corte_${reporte.sesion.id_sesion}.csv`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  };

  return <div className="min-w-0 space-y-5 pb-8 text-[#382B32]">
    <section className="relative overflow-hidden rounded-[1.8rem] border border-[#F0E0E7] bg-white p-5 shadow-sm sm:p-7"><div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#FC4D84]/10 blur-3xl"/><div className="relative flex flex-wrap items-center justify-between gap-4"><div className="flex gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.22em] text-[#FC4D84]">LUDAROPE · Operación diaria</p><h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Control de caja<span className="text-[#FC4D84]">.</span></h1><p className="mt-2 text-sm leading-6 text-[#9B8490]">Apertura, cobros, movimientos de efectivo y corte digital por caja.</p></div></div><button onClick={cargar} disabled={cargando} type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#EED6E0] bg-[#FFF8FB] px-4 py-3 text-sm font-bold text-[#C53D6D]"><RefreshCw size={17} className={cargando?'animate-spin':''}/> Actualizar</button></div>
      <div className="relative mt-6 grid gap-3 md:grid-cols-2"><label className="text-xs font-extrabold text-[#8D7480]"><span className="mb-2 block">Sucursal</span><select value={sucursal} disabled={!admin||Boolean(sesion)} onChange={e=>setSucursal(e.target.value)} className={input}>{sucursales.map(s=><option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}</select></label><label className="text-xs font-extrabold text-[#8D7480]"><span className="mb-2 block">Caja</span><select disabled={Boolean(sesion)} value={caja} onChange={e=>setCaja(e.target.value)} className={input}>{!cajas.length&&<option value="">Sin cajas asignadas</option>}{cajas.map(c=><option key={c.id_caja} value={c.id_caja}>{c.nombre}</option>)}</select></label></div>
      {caja&&<div className={`relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-bold ${sesion?'bg-emerald-50 text-emerald-800':'bg-[#FFF5EC] text-[#AB7239]'}`}><span className="flex items-center gap-2">{sesion?<CheckCircle2 size={18}/>:<LockKeyhole size={18}/>} {sesion?`Sesión abierta #${sesion.id_sesion} · ${sesion.cajero}`:'Caja cerrada'}</span>{sesion?<button type="button" disabled={!seleccionPermiteOperar} onClick={()=>setModal('cerrar')} className="rounded-lg bg-white px-4 py-2 font-bold text-[#AD446B]">Realizar corte</button>:<button type="button" disabled={!cajaActual?.activo} onClick={()=>setModal('abrir')} className="rounded-lg bg-[#FC4D84] px-4 py-2 text-white">Abrir caja</button>}</div>}
      {!cajas.length&&<p className="mt-4 rounded-xl bg-[#FFF4E8] px-4 py-3 text-sm text-[#A86D38]">No hay cajas disponibles para tu usuario. Solicita al administrador que configure y te asigne una.</p>}
    </section>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Indicador titulo="Venta del turno" valor={money(resumen.ventas_total)} Icono={Wallet} detalle={`${resumen.numero_ventas||0} ventas`}/><Indicador titulo="Ventas en efectivo" valor={money(resumen.ventas_efectivo)} Icono={Banknote}/><Indicador titulo="Débito + crédito" valor={money(Number(resumen.ventas_debito||0)+Number(resumen.ventas_credito||0))} Icono={CreditCard}/><Indicador titulo="Esperado en caja" valor={money(resumen.efectivo_esperado)} Icono={Calculator} detalle="Solo efectivo físico"/></div>
    <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]"><div className="rounded-[1.6rem] border border-[#F0DFE6] bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl font-semibold">Resumen del turno</h2><span className="rounded-full bg-[#FFF0F5] px-3 py-1.5 text-xs font-bold text-[#C33D6B]">{sesion?'Abierta':'Sin sesión'}</span></div><div className="mt-5 space-y-3 text-sm">{[['Fondo inicial',sesion?.monto_inicial],['Descuentos aplicados',resumen.descuentos_promociones],['Ventas en efectivo',resumen.ventas_efectivo],['Débito',resumen.ventas_debito],['Crédito',resumen.ventas_credito],['Transferencia',resumen.ventas_transferencia],['Entradas efectivo',resumen.entradas_efectivo],['Salidas y gastos',resumen.salidas_efectivo]].map(([titulo,monto])=><div className="flex justify-between gap-4 border-b border-[#F5E8ED] pb-3" key={titulo}><span className="text-[#9A838E]">{titulo}</span><strong className="text-[#43313B]">{money(monto)}</strong></div>)}<div className="flex justify-between gap-4 rounded-xl bg-[#FFF0F5] p-4 font-extrabold text-[#C63D6E]"><span>Efectivo esperado</span><strong>{money(resumen.efectivo_esperado)}</strong></div></div>{sesion&&seleccionPermiteOperar&&<button onClick={()=>setModal('movimiento')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3.5 text-sm font-bold text-white" type="button"><ArrowUpCircle size={17}/> Registrar movimiento</button>}</div>
      <div className="rounded-[1.6rem] border border-[#F0DFE6] bg-white p-5"><h2 className="font-serif text-2xl font-semibold">Movimientos de caja</h2>
      <p className="mt-1 text-xs text-[#9B8490]">Ventas, cancelaciones, entradas, retiros y gastos de la sesión.</p>
      {admin&&diagnostico?.ventas_sin_sesion_en_rango>0&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">Hay {diagnostico.ventas_sin_sesion_en_rango} venta(s) de esta sucursal y horario sin sesión asociada. No se suman al corte; verifica su origen.</p>}
      <div className="mt-4 max-h-[440px] space-y-2 overflow-y-auto">
        {!actividad.length&&<p className="rounded-xl bg-[#FFF9FB] p-5 text-sm text-[#947D88]">Todavía no hay ventas ni movimientos asociados a este turno.</p>}
        {[...actividad].reverse().map(a=><div className="flex items-center gap-3 rounded-xl border border-[#F0E3E9] p-3" key={a.id}>
          <div className={`rounded-xl p-2 ${a.clase==='VENTA'?'bg-[#FFF0F5] text-[#FC4D84]':a.clase==='CANCELACION'?'bg-rose-50 text-rose-600':Number(a.impacto_efectivo)>=0?'bg-emerald-50 text-emerald-600':'bg-[#FFF1EE] text-[#E46B54]'}`}>{a.clase==='VENTA'?<Wallet size={19}/>:a.clase==='CANCELACION'?<CircleAlert size={19}/>:Number(a.impacto_efectivo)>=0?<ArrowDownCircle size={19}/>:<ArrowUpCircle size={19}/>}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{a.clase==='VENTA'?`Venta ${a.folio}`:a.clase==='CANCELACION'?`Cancelación ${a.folio}`:a.concepto}</p>
            <p className="truncate text-xs text-[#A48C98]">{a.tipo.replaceAll('_',' ')} · {fecha(a.fecha)}</p>
            {a.clase==='VENTA'&&<p className="truncate text-[11px] text-[#A48C98]">{a.pagos}</p>}
          </div>
          <strong className={`shrink-0 text-sm ${a.clase==='CANCELACION'?'text-rose-600':'text-[#342833]'}`}>{a.importe_signo<0?'-':'+'}{money(a.monto)}</strong>
        </div>)}
      </div></div></section>
    <section className="rounded-[1.6rem] border border-[#F0DFE6] bg-white p-5"><div className="mb-4 flex items-center gap-2"><History size={19} className="text-[#FC4D84]"/><h2 className="font-serif text-2xl font-semibold">Historial de aperturas y cortes</h2></div><div className="overflow-x-auto"><table className="min-w-[660px] w-full text-left text-sm"><thead className="bg-[#FFF8FA] text-[11px] uppercase tracking-wider text-[#99818C]"><tr><th className="p-3">Sesión</th><th className="p-3">Cajero</th><th className="p-3">Apertura</th><th className="p-3">Cierre</th><th className="p-3">Diferencia</th><th className="p-3">Acción</th></tr></thead><tbody className="divide-y divide-[#F5E9EE]">{!historial.length&&<tr><td colSpan="6" className="p-5 text-center text-[#967F8B]">Sin historial para esta caja.</td></tr>}{historial.map(h=><tr key={h.id_sesion}><td className="p-3 font-bold">#{h.id_sesion}</td><td className="p-3">{h.cajero}</td><td className="p-3">{fecha(h.fecha_apertura)}</td><td className="p-3">{fecha(h.fecha_cierre)}</td><td className="p-3">{h.estado==='CERRADA'?money(h.diferencia):'—'}</td><td className="p-3">{h.estado==='CERRADA'?<button type="button" onClick={()=>verReporte(h)} className="flex items-center gap-2 rounded-lg bg-[#FFF0F5] px-3 py-2 text-xs font-bold text-[#C43F6E]"><FileText size={16}/> Ver corte</button>:<span className="text-xs text-emerald-700">Abierta</span>}</td></tr>)}</tbody></table></div></section>
    {modal==='abrir'&&<Dialogo titulo="Apertura de caja" onCerrar={()=>setModal('')}><p className="text-sm text-[#9A828C]">{cajaActual?.nombre} · Captura el fondo inicial en efectivo.</p><form onSubmit={abrir} className="space-y-4"><label className="block text-sm font-bold">Monto inicial ($)<input required min="0" step="0.01" type="number" value={inicial} onChange={e=>setInicial(e.target.value)} className={`${input} mt-2`}/></label><button disabled={guardando} className="w-full rounded-xl bg-[#FC4D84] px-4 py-4 font-extrabold text-white disabled:opacity-50">Abrir caja</button></form></Dialogo>}
    {modal==='movimiento'&&<Dialogo titulo="Movimiento de efectivo" onCerrar={()=>setModal('')}><p className="text-xs leading-5 text-[#987F89]">Registra solamente movimientos físicos de efectivo. Los pagos de ventas ya se agregan automáticamente al resumen.</p><form onSubmit={registrar} className="space-y-4"><label className="block text-sm font-bold">Tipo<select className={`${input} mt-2`} value={mov.tipo} onChange={e=>setMov(p=>({...p,tipo:e.target.value}))}>{tipos.filter(t=>admin||!t[0].startsWith('AJUSTE')).map(([id,txt])=><option value={id} key={id}>{txt}</option>)}</select></label><label className="block text-sm font-bold">Concepto<input required maxLength={180} className={`${input} mt-2`} value={mov.concepto} onChange={e=>setMov(p=>({...p,concepto:e.target.value}))}/></label><label className="block text-sm font-bold">Monto ($)<input required type="number" step="0.01" min="0.01" className={`${input} mt-2`} value={mov.monto} onChange={e=>setMov(p=>({...p,monto:e.target.value}))}/></label><label className="block text-sm font-bold">Referencia (opcional)<input maxLength={120} className={`${input} mt-2`} value={mov.referencia} onChange={e=>setMov(p=>({...p,referencia:e.target.value}))}/></label><label className="block text-sm font-bold">Observaciones<textarea rows={2} maxLength={500} className={`${input} mt-2`} value={mov.observaciones} onChange={e=>setMov(p=>({...p,observaciones:e.target.value}))}/></label><button disabled={guardando} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-4 text-sm font-black text-white disabled:opacity-50"><Save size={17}/> Guardar movimiento</button></form></Dialogo>}
    {modal==='cerrar'&&<Dialogo titulo="Corte y cierre de caja" onCerrar={()=>setModal('')}><div className="flex flex-wrap justify-between gap-3 rounded-xl bg-[#FFF0F5] p-4 text-sm"><span>Efectivo esperado</span><strong className="text-lg text-[#C83E6F]">{money(resumen.efectivo_esperado)}</strong></div><form onSubmit={cerrar} className="space-y-4"><label className="flex items-center gap-3 rounded-xl bg-[#FFF9FB] p-3 text-sm font-bold"><input type="checkbox" checked={usarConteo} onChange={e=>setUsarConteo(e.target.checked)} className="accent-[#FC4D84]"/> Contar billetes y monedas</label>{usarConteo?<Conteo valor={denominaciones} setValor={setDenominaciones}/>:<label className="block text-sm font-bold">Efectivo contado<input type="number" required step="0.01" min="0" className={`${input} mt-2`} value={contado} onChange={e=>setContado(e.target.value)}/></label>}<div className="flex justify-between rounded-xl bg-[#FFF9FB] p-3 text-sm font-bold"><span>Diferencia</span><span>{money((usarConteo?cashContado:Number(contado||0))-Number(resumen.efectivo_esperado||0))}</span></div><label className="block text-sm font-bold">Observaciones de cierre<textarea rows={2} maxLength={500} className={`${input} mt-2`} value={observaciones} onChange={e=>setObservaciones(e.target.value)}/></label><p className="flex items-start gap-2 text-xs leading-5 text-[#A77948]"><CircleAlert size={16} className="shrink-0"/> Cerrar la caja bloqueará las nuevas ventas asociadas a esta sesión. El corte quedará guardado y podrá consultarse después.</p><button disabled={guardando} className="w-full rounded-xl bg-[#FC4D84] px-4 py-4 text-sm font-black text-white disabled:opacity-50">Confirmar corte</button></form></Dialogo>}
    {modal==='reporte'&&reporte&&<Dialogo titulo={`Corte #${reporte.sesion.id_sesion}`} onCerrar={()=>{setModal('');setReporte(null);}}><p className="text-sm text-[#A08A95]">{reporte.sesion.caja} · {reporte.sesion.sucursal} · {fecha(reporte.sesion.fecha_cierre)}</p><div className="grid grid-cols-2 gap-3"><Indicador titulo="Vendido" valor={money(reporte.resumen.ventas_total)} Icono={Wallet}/><Indicador titulo="Efectivo esperado" valor={money(reporte.resumen.efectivo_esperado)} Icono={Calculator}/><Indicador titulo="Efectivo contado" valor={money(reporte.resumen.efectivo_contado)} Icono={Banknote}/><Indicador titulo="Diferencia" valor={money(reporte.resumen.diferencia)} Icono={CheckCircle2}/></div><div className="space-y-2 rounded-xl bg-[#FFF9FB] p-4 text-sm">{[['Descuentos aplicados',reporte.resumen.descuentos_promociones],['Efectivo',reporte.resumen.ventas_efectivo],['Débito',reporte.resumen.ventas_debito],['Crédito',reporte.resumen.ventas_credito],['Transferencia',reporte.resumen.ventas_transferencia],['Entradas',reporte.resumen.entradas_efectivo],['Salidas',reporte.resumen.salidas_efectivo]].map(([k,v])=><div key={k} className="flex justify-between"><span>{k}</span><strong>{money(v)}</strong></div>)}</div>
      <div className="rounded-xl border border-[#F0DDE5] p-4">
        <h4 className="font-bold text-[#46333E]">Ventas asociadas a este corte ({(reporte.ventas||[]).length})</h4>
        <div className="mt-3 max-h-44 space-y-2 overflow-y-auto text-xs">
          {!(reporte.ventas||[]).length&&<p className="text-[#977D88]">No hay ventas vinculadas a esta sesión.</p>}
          {(reporte.ventas||[]).map(v=><div key={v.id_venta} className="flex justify-between gap-3 border-b border-[#F6E9EE] py-2">
            <div><p className="font-bold">{v.folio} {v.estado==='CANCELADA'?'· Cancelada':''}</p><p className="text-[#9C8290]">{v.pagos}</p></div><span className="font-bold">{money(v.total)}</span>
          </div>)}
        </div>
      </div>
      <div className="rounded-xl border border-[#F0DDE5] p-4">
        <h4 className="font-bold text-[#46333E]">Cronología de movimientos ({(reporte.actividad||[]).length})</h4>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto text-xs">
          {!(reporte.actividad||[]).length&&<p className="text-[#977D88]">Sin movimientos registrados.</p>}
          {(reporte.actividad||[]).map(a=><div key={a.id} className="flex items-start justify-between gap-2 border-b border-[#F6E9EE] py-2">
            <div className="min-w-0"><p className="font-bold">{a.tipo.replaceAll('_',' ')} · {a.folio||'Efectivo'}</p><p className="text-[#9C8290]">{fecha(a.fecha)} · {a.concepto}</p></div>
            <span className="shrink-0 font-bold">{a.importe_signo<0?'-':'+'}{money(a.monto)}</span>
          </div>)}
        </div>
      </div>
      {admin&&reporte.diagnostico?.ventas_sin_sesion_en_rango>0&&<p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Atención: {reporte.diagnostico.ventas_sin_sesion_en_rango} venta(s) sin sesión vinculada en el horario de esta sucursal. No se incluyen hasta verificar su origen.</p>}
      <button type="button" onClick={descargarPDF} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-4 text-sm font-black text-white"><Download size={17}/> Descargar corte PDF</button><button type="button" onClick={exportarCSV} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#EFD4DF] bg-white px-4 py-3 text-sm font-bold text-[#C43F6E]"><Download size={17}/> Exportar CSV</button></Dialogo>}
  </div>;
}
