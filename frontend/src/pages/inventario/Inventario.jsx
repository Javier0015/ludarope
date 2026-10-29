import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CheckCircle2, ClipboardList, Grid2X2, ImagePlus, ScanBarcode, Loader2, Package, Plus, RefreshCw, Search, Shirt, Store, Table2, Trash2, Pencil, X } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import BuscadorCatalogo from '../../components/BuscadorCatalogo';
import EditarPrendaModal from './EditarPrendaModal';
import './inventario.css';

const C = { pink: '#FC4D84', coral: '#FE714B', orange: '#FF751F', gold: '#E7AA44' };
const input = 'ld-field';
const money = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const inicio = { nombre: '', descripcion: '', id_categoria: '', id_talla: '', id_color: '', id_sucursal: '', cantidad: '1', precio_venta: '', codigo_barras: '', publicar_catalogo: true };
const origen = (import.meta.env.VITE_API_URL || '/api').startsWith('http')
  ? new URL(import.meta.env.VITE_API_URL).origin : window.location.origin;
const fotoUrl = (ruta) => ruta?.startsWith('http') ? ruta : `${origen}${ruta || ''}`;

export default function Inventario() {
  const { usuario } = useAuth();
  const admin = usuario?.rol === 'ADMIN';
  const [tab, setTab] = useState('consulta');
  const [opciones, setOpciones] = useState({ categorias: [], tallas: [], colores: [] });
  const [sucursales, setSucursales] = useState([]);
  const [filtroSucursal, setFiltroSucursal] = useState('');
  const [prendas, setPrendas] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [camaraOrientacion, setCamaraOrientacion] = useState('environment');
  const [camaraEstado, setCamaraEstado] = useState('cargando');
  const [camaraMensaje, setCamaraMensaje] = useState('');
  const [capturando, setCapturando] = useState(false);
  const videoRef = useRef(null);
  const [form, setForm] = useState(inicio);
  const [reinicio, setReinicio] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [presentacion, setPresentacion] = useState('tarjetas');
  const [prendaEditando, setPrendaEditando] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargaInicial = useCallback(async () => {
    try {
      setCargando(true); setError('');
      const [c, t, co, s] = await Promise.all([
        api.get('/inventario/catalogos/categorias'), api.get('/inventario/catalogos/tallas'),
        api.get('/inventario/catalogos/colores'), api.get('/inventario/sucursales'),
      ]);
      setOpciones({ categorias: c.data.opciones, tallas: t.data.opciones, colores: co.data.opciones });
      setSucursales(s.data.sucursales);
      const defaultSucursal = admin ? '' : String(usuario?.id_sucursal || '');
      setFiltroSucursal(defaultSucursal);
      setForm((prev) => ({ ...prev, id_sucursal: String(s.data.sucursales[0]?.id_sucursal || '') }));
    } catch (e) { setError(e.response?.data?.mensaje || 'No se pudo cargar la configuración de inventario'); }
    finally { setCargando(false); }
  }, [admin, usuario?.id_sucursal]);
  useEffect(() => { cargaInicial(); }, [cargaInicial]);

  const cargarPrendas = useCallback(async () => {
    try {
      setError('');
      const params = filtroSucursal ? { id_sucursal: filtroSucursal } : {};
      const { data } = await api.get('/inventario/prendas', { params });
      setPrendas(data.prendas || []);
    } catch (e) { setError(e.response?.data?.mensaje || 'Error al consultar prendas'); }
  }, [filtroSucursal]);
  useEffect(() => { cargarPrendas(); }, [cargarPrendas]);

  const cambiar = (campo, valor) => setForm((p) => ({ ...p, [campo]: valor }));
  const refrescarOpciones = async (tipo) => {
    const { data } = await api.get(`/inventario/catalogos/${tipo}`);
    setOpciones((p) => ({ ...p, [tipo]: data.opciones || [] }));
  };
  const agregarOpcion = async (tipo, nombre) => {
    try {
      const { data } = await api.post(`/inventario/catalogos/${tipo}`, { nombre });
      await refrescarOpciones(tipo);
      return data.opcion;
    } catch (e) { Swal.fire('No se pudo agregar', e.response?.data?.mensaje || 'Intenta nuevamente', 'error'); throw e; }
  };
  const desactivarOpcion = async (tipo, opcion) => {
    if (!admin) return;
    const conf = await Swal.fire({ icon: 'question', title: '¿Desactivar esta opción?',
      text: `${opcion.nombre} dejará de mostrarse en nuevos registros, pero se conservará en las prendas ya registradas.`,
      showCancelButton: true, confirmButtonText: 'Desactivar', cancelButtonText: 'Cancelar', confirmButtonColor: C.pink });
    if (!conf.isConfirmed) return;
    try { await api.delete(`/inventario/catalogos/${tipo}/${opcion.id}`); await refrescarOpciones(tipo); }
    catch (e) { Swal.fire('Error', e.response?.data?.mensaje || 'No se pudo desactivar', 'error'); }
  };
  const agregarFotos = (e) => {
    const archivos = Array.from(e.target.files || []);
    if (archivos.some((f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 6 * 1024 * 1024)) {
      Swal.fire('Fotografía no válida', 'Solo JPG, PNG o WebP, hasta 6 MB por archivo.', 'warning');
      e.target.value = ''; return;
    }
    if (fotos.length + archivos.length > 4) { Swal.fire('Máximo 4 fotos', 'Retira alguna imagen antes de agregar otra.', 'warning'); e.target.value=''; return; }
    setFotos((p) => [...p, ...archivos]); e.target.value = '';
  };
  // La cámara funciona en localhost o bajo HTTPS. Libera siempre el dispositivo
  // al cerrar el modal, alternar cámaras o salir de la pantalla.
  useEffect(() => {
    if (!camaraAbierta) return;

    let vigente = true;
    let stream = null;
    const video = videoRef.current;

    const iniciarCamara = async () => {
      setCamaraEstado('cargando');
      setCamaraMensaje('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setCamaraEstado('error');
        setCamaraMensaje('La cámara no está disponible. Prueba en localhost, con HTTPS o usa Cargar imágenes.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: camaraOrientacion } },
          audio: false,
        });

        if (!vigente) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (!video) throw new Error('No se encontró la vista previa de la cámara');

        video.srcObject = stream;
        await video.play();
        if (vigente) setCamaraEstado('lista');
      } catch (error) {
        if (!vigente) return;
        console.error('No se pudo abrir la cámara:', error);
        setCamaraEstado('error');
        setCamaraMensaje(
          error?.name === 'NotAllowedError'
            ? 'Se rechazó el permiso de cámara. Autorízalo en el navegador o usa Cargar imágenes.'
            : 'No se pudo iniciar la cámara. Verifica que no esté ocupada y vuelve a intentar.'
        );
      }
    };

    iniciarCamara();

    return () => {
      vigente = false;
      stream?.getTracks().forEach((track) => track.stop());
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [camaraAbierta, camaraOrientacion]);

  const capturarFoto = () => {
    if (capturando || fotos.length >= 4) return;

    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      Swal.fire('Cámara iniciando', 'Aguarda a que aparezca la imagen antes de tomar la foto.', 'info');
      return;
    }

    // Reducir la fotografía a 1600 px como máximo para facilitar la subida.
    const factor = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * factor);
    canvas.height = Math.round(video.videoHeight * factor);
    const contexto = canvas.getContext('2d');
    if (!contexto) return;
    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);

    setCapturando(true);
    canvas.toBlob((blob) => {
      setCapturando(false);
      if (!blob || blob.size > 6 * 1024 * 1024) {
        Swal.fire('Error al capturar', 'No se pudo generar una fotografía válida.', 'error');
        return;
      }

      const archivo = new File(
        [blob],
        `prenda_${Date.now()}_${fotos.length + 1}.jpg`,
        { type: 'image/jpeg' }
      );
      setFotos((anteriores) => anteriores.length >= 4
        ? anteriores : [...anteriores, archivo]);

      // Permitir varias capturas sucesivas; cerrar al llegar al máximo.
      if (fotos.length + 1 >= 4) setCamaraAbierta(false);
    }, 'image/jpeg', 0.85);
  };

  const fotosPreview = useMemo(() => fotos.map((file) => ({ file, url: URL.createObjectURL(file) })), [fotos]);
  useEffect(() => () => fotosPreview.forEach((a) => URL.revokeObjectURL(a.url)), [fotosPreview]);

  const guardar = async (continuar) => {
    if (!form.nombre.trim() || !form.id_categoria || !form.id_talla || !form.id_color || !form.id_sucursal ||
      Number(form.precio_venta) <= 0 || !Number.isInteger(Number(form.cantidad)) || Number(form.cantidad) < 1) {
      return Swal.fire('Datos incompletos', 'Completa los campos obligatorios y selecciona opciones del catálogo.', 'warning');
    }
    const codigoBarras = String(form.codigo_barras || '').trim().toUpperCase();
    if (codigoBarras && !/^[A-Z0-9._-]{3,80}$/.test(codigoBarras)) {
      return Swal.fire('Código de barras inválido', 'Usa de 3 a 80 caracteres: letras, números, puntos, guiones o guion bajo.', 'warning');
    }
    try {
      setGuardando(true);
      const datos = new FormData();
      Object.entries(form).forEach(([k, v]) => datos.append(k, String(v)));
      fotos.forEach((foto) => datos.append('fotos', foto));
      const { data } = await api.post('/inventario/prendas', datos);
      await Swal.fire({ icon: 'success', title: 'Prenda guardada', text: `Código ${data.codigo}`, timer: 1300, showConfirmButton: false });
      setForm((p) => ({ ...inicio, id_sucursal: p.id_sucursal, publicar_catalogo: p.publicar_catalogo }));
      setFotos([]); setReinicio((n) => n + 1);
      await cargarPrendas();
      setTab(continuar ? 'registro' : 'consulta');
    } catch (e) {
      Swal.fire('No se guardó', e.response?.data?.mensaje || 'Revisa la conexión del servidor', 'error');
    } finally { setGuardando(false); }
  };

  const cambiarPublicacion = async (p) => {
    if (!admin) return;
    try {
      await api.patch(`/inventario/prendas/${p.id_prenda}/publicacion`, {
        publicar_catalogo: !p.publicar_catalogo,
      });
      await cargarPrendas();
    } catch (e) { Swal.fire('Error', e.response?.data?.mensaje || 'No se pudo actualizar el catálogo', 'error'); }
  };

  // Permite capturar, sustituir o quitar el código de barras de una prenda existente.
  const editarCodigoBarras = async (p) => {
    if (!admin) return;
    const respuesta = await Swal.fire({
      title: 'Código de barras',
      text: `Prenda: ${p.nombre}. Déjalo vacío si no tiene código.`,
      input: 'text',
      inputValue: p.codigo_barras || '',
      inputPlaceholder: 'Escribe o escanea el código de barras',
      inputAttributes: { maxLength: '80', autoComplete: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: C.pink,
      inputValidator: (valor) => {
        const limpio = String(valor || '').trim().toUpperCase();
        if (limpio && !/^[A-Z0-9._-]{3,80}$/.test(limpio)) {
          return 'Usa de 3 a 80 caracteres: letras, números, puntos, guiones o guion bajo.';
        }
        return undefined;
      },
    });
    if (!respuesta.isConfirmed) return;
    try {
      await api.patch(`/inventario/prendas/${p.id_prenda}/codigo-barras`, {
        codigo_barras: String(respuesta.value || '').trim() || null,
      });
      await cargarPrendas();
      Swal.fire({ icon: 'success', title: 'Código actualizado', timer: 1100, showConfirmButton: false });
    } catch (e) {
      Swal.fire('No se pudo actualizar', e.response?.data?.mensaje || 'Revisa la conexión con el servidor.', 'error');
    }
  };

  const ajustarExistencia = async (p) => {
    if (!admin) return;
    if (!filtroSucursal) return Swal.fire('Selecciona una sucursal', 'Elige una sucursal específica antes de ajustar sus existencias.', 'info');
    const r = await Swal.fire({
      title: `Ajustar: ${p.nombre}`,
      input: 'number',
      inputLabel: 'Diferencia de stock: usa -1 para retirar una unidad o 1 para agregarla.',
      inputAttributes: { step: '1', min: '-10000', max: '10000' },
      inputPlaceholder: 'Ej. -1',
      showCancelButton: true,
      confirmButtonText: 'Registrar ajuste',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: C.pink,
      inputValidator: (v) => !Number.isInteger(Number(v)) || Number(v)===0 ? 'Introduce un número entero distinto de cero' : undefined,
    });
    if (!r.isConfirmed) return;
    try {
      await api.post(`/inventario/prendas/${p.id_prenda}/ajustar-stock`, {
        id_sucursal: Number(filtroSucursal), diferencia: Number(r.value), observaciones: 'Ajuste desde inventario',
      });
      await cargarPrendas();
      Swal.fire({ icon: 'success', title: 'Stock actualizado', timer: 1200, showConfirmButton: false });
    } catch (e) { Swal.fire('No se pudo ajustar', e.response?.data?.mensaje || 'Error en la operación', 'error'); }
  };

  const lista = useMemo(() => prendas.filter((p) =>
    [p.id_prenda, `LDR-${String(p.id_prenda).padStart(6,'0')}`, p.nombre, p.categoria, p.talla, p.color, p.codigo_barras || ''].join(' ').toLowerCase().includes(busqueda.toLowerCase())
  ), [prendas, busqueda]);
  const hayExistencias = lista.reduce((s, p) => s + Number(p.cantidad || 0), 0);

  return (
    <>
    <div className="ld-inventory w-full min-w-0 space-y-5 pb-8">
      {/* Encabezado más compacto: no compite con el header global. */}
      <section className="ld-panel relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-32 h-64 w-64 rounded-full bg-[#FFF0F5]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#FC4D84]">LUDAROPE / Inventario</p>
            <h1 className="mt-2 font-serif text-[clamp(2rem,3vw,3rem)] font-semibold leading-none text-[#342A32]">Gestión de prendas<span className="text-[#FC4D84]">.</span></h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#8A7780]">
              Registra prendas únicas, organiza existencias y actualiza automáticamente el catálogo digital.
            </p>
          </div>
          <button type="button" onClick={() => setTab('registro')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-5 py-3 text-sm font-bold text-white shadow-[0_9px_22px_rgba(252,77,132,.17)] transition hover:bg-[#E83B73]">
            <Plus size={17} /> Nueva prenda
          </button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-2 border-b border-[#EEE3E7] pb-3">
        {[
          ['consulta', 'Existencias', Package],
          ['registro', 'Registrar prenda', Shirt],
        ].map(([clave, titulo, Icono]) => (
          <button type="button" key={clave} onClick={() => setTab(clave)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === clave
              ? 'bg-[#FC4D84] text-white shadow-sm'
              : 'bg-white text-[#806B75] hover:bg-[#FFF0F5]'}`}>
            <Icono size={17} /> {titulo}
          </button>
        ))}
      </div>

      {tab === 'registro' ? (
        <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.8fr)]">
          {/* Los campos y selectores nunca quedan debajo de la galería. */}
          <section className="ld-panel min-w-0 p-4 sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#FC4D84]"><Shirt size={23}/></span>
              <div>
                <h2 className="text-lg font-extrabold text-[#352A30]">Datos de la prenda</h2>
                <p className="text-xs text-[#927D87]">Completa la información para darla de alta en inventario.</p>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <label className="ld-form-label">Sucursal <span className="text-[#FC4D84]">*</span></label>
                <select value={form.id_sucursal} disabled={!admin} onChange={(e) => cambiar('id_sucursal', e.target.value)} className={input}>
                  <option value="">Selecciona una sucursal</option>
                  {sucursales.map((sucursal) => (
                    <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>{sucursal.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="ld-form-label">Nombre de la prenda <span className="text-[#FC4D84]">*</span></label>
                <input maxLength={180} className={input} value={form.nombre}
                  onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej. Vestido floral rosa" />
              </div>
              {[
                ['categorias','id_categoria','Categoría'],
                ['tallas','id_talla','Talla'],
                ['colores','id_color','Color'],
              ].map(([tipo, campo, titulo]) => (
                <BuscadorCatalogo key={tipo} titulo={titulo} valor={form[campo]} opciones={opciones[tipo]}
                  alCambiar={(v) => cambiar(campo, v)} agregar={(nombre) => agregarOpcion(tipo, nombre)}
                  desactivar={(op) => desactivarOpcion(tipo, op)} administrador={admin} reinicio={reinicio} />
              ))}
              <div className="min-w-0">
                <label className="ld-form-label">Cantidad <span className="text-[#FC4D84]">*</span></label>
                <input className={input} min="1" max="10000" step="1" type="number" value={form.cantidad}
                  onChange={(e) => cambiar('cantidad', e.target.value)}/>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="ld-form-label">Código de barras <span className="font-normal text-[#AE98A2]">(opcional)</span></label>
                <div className="relative">
                  <ScanBarcode size={19} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#CA7494]" />
                  <input
                    className={`${input} pl-11`}
                    maxLength={80}
                    autoComplete="off"
                    value={form.codigo_barras}
                    onChange={(e) => cambiar('codigo_barras', e.target.value)}
                    placeholder="Escríbelo o escanéalo; puedes dejarlo vacío"
                  />
                </div>
                <p className="mt-1.5 text-xs text-[#A18C96]">Opcional. No sustituye el código interno LDR. Se acepta texto alfanumérico, guiones, puntos y guion bajo.</p>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="ld-form-label">Precio de venta <span className="text-[#FC4D84]">*</span></label>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#FC4D84]">$</span>
                  <input className={`${input} ld-field-price`} min="0.01" step="0.01" type="number"
                    value={form.precio_venta} onChange={(e) => cambiar('precio_venta', e.target.value)} placeholder="0.00" />
                </div>
                <p className="mt-1.5 text-xs text-[#A18C96]">El costo de compra se captura en un apartado privado de administración.</p>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <label className="ld-form-label">Descripción <span className="font-normal text-[#AE98A2]">(opcional)</span></label>
                <textarea rows={3} maxLength={1500} className={input} value={form.descripcion}
                  onChange={(e) => cambiar('descripcion', e.target.value)} placeholder="Material, detalles o condición de la prenda..." />
              </div>
            </div>
          </section>

          {/* Panel secundario: carga de imágenes, catálogo y acciones. */}
          <aside className="ld-panel min-w-0 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3EB] text-[#FE714B]"><Camera size={20}/></span>
              <div>
                <h2 className="text-base font-extrabold text-[#352A30]">Fotografías</h2>
                <p className="text-xs text-[#927D87]">Hasta cuatro imágenes por prenda</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fotosPreview.map(({ url, file }, index) => (
                <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl border border-[#F1E2E8] bg-[#FFF7F9]">
                  <img src={url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                  {index === 0 && <span className="absolute bottom-2 left-2 rounded-lg bg-[#FC4D84] px-2 py-1 text-[10px] font-bold text-white">Portada</span>}
                  <button type="button" aria-label="Quitar fotografía" onClick={() => setFotos((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#D52D67] shadow-sm"><X size={16}/></button>
                </div>
              ))}
              {Array.from({ length: 4 - fotos.length }, (_, n) => (
                <div key={`espacio-${n}`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#F2D6E0] bg-[#FFF9FB] text-[#CF9BAE]">
                  <ImagePlus size={23}/>
                  <span className="text-xs font-semibold">Foto {fotos.length + n + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={fotos.length >= 4 || guardando}
                onClick={() => setCamaraAbierta(true)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E83B73] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Camera size={19}/> Usar cámara
              </button>
              <label className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#F1C4D3] bg-[#FFF7FA] px-4 py-3 text-sm font-bold text-[#C93669] transition ${fotos.length >= 4 || guardando ? 'pointer-events-none opacity-40' : 'cursor-pointer hover:bg-[#FFEAF2]'}`}>
                <ImagePlus size={19}/> Cargar imágenes
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={fotos.length >= 4 || guardando}
                  onChange={agregarFotos}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="mt-2 text-xs font-semibold text-[#896F7B]">{fotos.length} de 4 fotografías seleccionadas</p>
            <p className="ld-section-note mt-3">JPG, PNG o WebP. Máximo 6 MB cada una. La primera será la portada del catálogo.</p>

            <div className="mt-5 border-t border-[#F1E6E9] pt-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#FFF6F8] p-3.5">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#FC4D84]" checked={form.publicar_catalogo}
                  onChange={(e) => cambiar('publicar_catalogo', e.target.checked)}/>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#352A30]">Publicar en catálogo digital</span>
                  <span className="mt-1 block text-xs leading-relaxed text-[#947F89]">Visible al tener fotografía y existencias disponibles.</span>
                </span>
              </label>
            </div>

            <div className="mt-5 grid gap-2">
              <button disabled={guardando} onClick={() => guardar(false)} type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E83B73] disabled:opacity-50">
                {guardando ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>} Guardar prenda
              </button>
              <button disabled={guardando} onClick={() => guardar(true)} type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#F1B9CA] bg-white px-4 py-3 text-sm font-bold text-[#D93A70] transition hover:bg-[#FFF4F7] disabled:opacity-50">
                <Plus size={17}/> Guardar y agregar otra
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="ld-panel p-4 sm:p-5">
            <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] xl:grid-cols-[minmax(0,1fr)_minmax(190px,280px)_auto_auto]">
              <div className="min-w-0">
                <label className="ld-form-label">Buscar por nombre, talla, color o código de barras</label>
                <input className={input} value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} placeholder="Nombre, código de barras, LDR..."/>
              </div>
              {admin && <div className="min-w-0 sm:col-span-3 xl:col-span-1"><label className="ld-form-label">Sucursal</label>
                <select className={input} value={filtroSucursal} onChange={(e)=>setFiltroSucursal(e.target.value)}>
                  <option value="">Todas las sucursales</option>
                  {sucursales.map((s)=><option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}
                </select>
              </div>}
              <button type="button" onClick={cargarPrendas} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#F0DAE2] bg-[#FFF8FA] px-3 text-[#FC4D84]" title="Actualizar">
                <RefreshCw size={18}/><span className="text-xs font-semibold sm:hidden">Actualizar</span>
              </button>
              <button type="button" onClick={()=>setPresentacion(presentacion==='tarjetas'?'tabla':'tarjetas')}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#F0DAE2] bg-[#FFF8FA] px-3 text-[#FC4D84]" title="Cambiar vista">
                {presentacion==='tarjetas'?<Table2 size={18}/>:<Grid2X2 size={18}/>}<span className="text-xs font-semibold sm:hidden">Cambiar vista</span>
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Referencias registradas',lista.length],['Unidades en inventario',hayExistencias],['Agotadas',lista.filter((p)=>Number(p.cantidad)===0).length]].map(([titulo,valor]) => (
              <div key={titulo} className="ld-panel p-4"><p className="text-xs font-medium text-[#95818A]">{titulo}</p><p className="mt-1 text-2xl font-extrabold text-[#352A30]">{valor}</p></div>
            ))}
          </div>
          {cargando ? <div className="ld-panel p-10 text-center text-sm text-[#97808A]">Cargando prendas...</div> :
            lista.length === 0 ? <div className="ld-panel p-10 text-center text-sm text-[#927E88]">No hay prendas registradas con los filtros actuales.</div> :
              presentacion === 'tarjetas' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {lista.map((p) => (
                    <article key={p.id_prenda} className="ld-panel min-w-0 overflow-hidden">
                      <div className="h-48 bg-[#FFF1F5]">{p.fotos?.length ?
                        <img src={fotoUrl(p.fotos[0])} alt={p.nombre} className="h-full w-full object-cover"/> :
                        <div className="flex h-full items-center justify-center text-[#E69AB4]"><ImagePlus size={38}/></div>}</div>
                      <div className="space-y-2.5 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><h3 className="break-words text-sm font-bold">{p.nombre}</h3>
                            <p className="mt-1 text-xs text-[#9C8790]">{p.categoria} · {p.talla} · {p.color}</p></div>
                          <span className="shrink-0 text-[10px] font-semibold text-[#D4386C]">LDR-{String(p.id_prenda).padStart(6,'0')}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-lg font-extrabold">{money(p.precio_venta)}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${Number(p.cantidad)>0?'bg-emerald-50 text-emerald-700':'bg-orange-50 text-orange-700'}`}>
                            {Number(p.cantidad)>0 ? `${p.cantidad} disponible(s)` : 'Agotada'}
                          </span>
                        </div>
                        <p className="flex items-center gap-1.5 break-all text-xs text-[#957D88]"><ScanBarcode size={15} className="shrink-0"/> Código de barras: {p.codigo_barras || 'Sin código'}</p>
                        <p className="text-xs text-[#957D88]">Catálogo: {p.publicar_catalogo && Number(p.cantidad)>0 && p.fotos?.length ? 'Visible' : 'No visible'}</p>
                        {admin && <div className="flex flex-wrap gap-2 border-t border-[#F3E4E9] pt-3">
                          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-[#FC4D84] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#E83B73]" onClick={() => setPrendaEditando(p.id_prenda)}><Pencil size={15}/> Editar prenda</button>
                          <button type="button" className="rounded-lg bg-[#FFF0F5] px-3 py-2 text-xs font-bold text-[#D43B70]" onClick={()=>cambiarPublicacion(p)}>{p.publicar_catalogo ? 'Ocultar del catálogo' : 'Publicar'}</button>
                          <button type="button" className="rounded-lg border border-[#F3D7E1] px-3 py-2 text-xs font-bold text-[#8E6B79]" onClick={()=>ajustarExistencia(p)}>Ajustar stock</button>
                           <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-[#F3D7E1] px-3 py-2 text-xs font-bold text-[#8E6B79]" onClick={()=>editarCodigoBarras(p)}><ScanBarcode size={15}/> Código de barras</button>
                        </div>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ld-panel overflow-x-auto">
                  <table className="w-full min-w-[940px] text-left text-sm">
                    <thead className="bg-[#FFF7F9] text-xs font-bold text-[#836D77]"><tr>{['Código interno','Código de barras','Prenda','Categoría','Talla','Color','Precio','Stock', ...(admin ? ['Acciones'] : [])].map((x)=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead>
                    <tbody>{lista.map((p)=><tr key={p.id_prenda} className="border-t border-[#F5E9ED]">
                      <td className="px-4 py-3">LDR-{String(p.id_prenda).padStart(6,'0')}</td>
                      <td className="px-4 py-3 break-all">{p.codigo_barras || '—'}</td>
                      <td className="px-4 py-3 font-semibold">{p.nombre}</td>
                      <td className="px-4 py-3">{p.categoria}</td><td className="px-4 py-3">{p.talla}</td><td className="px-4 py-3">{p.color}</td>
                      <td className="px-4 py-3">{money(p.precio_venta)}</td><td className="px-4 py-3">{p.cantidad}</td>
                      {admin && <td className="px-4 py-3"><button type="button" onClick={() => setPrendaEditando(p.id_prenda)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFF0F5] px-3 py-2 text-xs font-bold text-[#CC376C] hover:bg-[#FFE2EC]"><Pencil size={15}/> Editar</button></td>}
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
        </section>
      )}
    </div>
      {admin && prendaEditando && <EditarPrendaModal
        idPrenda={prendaEditando}
        opciones={opciones}
        fotoUrl={fotoUrl}
        onCerrar={() => setPrendaEditando(null)}
        onGuardado={cargarPrendas}
      />}
      {camaraAbierta && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#241D28]/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Tomar fotografías de la prenda">
          <section className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#F3E3E9] px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#FC4D84]"><Camera size={21}/></span>
                <div>
                  <h2 className="font-extrabold text-[#352A30]">Tomar fotografía</h2>
                  <p className="text-xs text-[#917C86]">Foto {Math.min(fotos.length + 1, 4)} de 4</p>
                </div>
              </div>
              <button type="button" onClick={() => setCamaraAbierta(false)} aria-label="Cerrar cámara" className="rounded-xl bg-[#FFF0F5] p-2 text-[#D43C71] hover:bg-[#FFE2EC]"><X size={20}/></button>
            </div>

            <div className="bg-[#18151A]">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-[4/3] max-h-[60vh] w-full object-contain"
                aria-label="Vista en vivo de la cámara"
              />
              {camaraEstado !== 'lista' && (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-5 text-center text-sm text-white">
                  {camaraEstado === 'cargando' ? <Loader2 className="animate-spin" size={25}/> : <Camera size={25}/>}
                  <p>{camaraEstado === 'cargando' ? 'Solicitando permiso y preparando la cámara...' : camaraMensaje}</p>
                  {camaraEstado === 'error' && (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 font-bold text-white">
                      <Camera size={17}/> Abrir cámara del teléfono
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="sr-only"
                        onChange={(e) => { agregarFotos(e); setCamaraAbierta(false); }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setCamaraOrientacion((p) => p === 'environment' ? 'user' : 'environment')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#F2DCE4] px-3 py-2.5 text-sm font-bold text-[#805969] hover:bg-[#FFF7FA]"
                title="Cambiar cámara delantera o trasera, si el dispositivo dispone de ambas"
              >
                <RefreshCw size={16}/> Cambiar cámara
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setCamaraAbierta(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#775E6A] hover:bg-[#FFF7FA]">Finalizar</button>
                <button
                  type="button"
                  disabled={camaraEstado !== 'lista' || capturando || fotos.length >= 4}
                  onClick={capturarFoto}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E83B73] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {capturando ? <Loader2 size={18} className="animate-spin"/> : <Camera size={18}/>}
                  Capturar foto
                </button>
              </div>
            </div>
            <p className="px-4 pb-4 text-xs text-[#927F86] sm:px-6">Las fotos tomadas se agregan a la misma galería que las imágenes cargadas. Puedes mezclar ambos métodos.</p>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
