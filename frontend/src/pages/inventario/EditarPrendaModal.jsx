import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera, CheckCircle2, ImagePlus, Loader2, Pencil, RefreshCw,
  Save, ScanBarcode, Shirt, X,
} from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../../api/axios';

const maxFotos = 4;
const formatos = new Set(['image/jpeg', 'image/png', 'image/webp']);
const claseCampo = 'ld-field';
const vacio = { nombre: '', descripcion: '', id_categoria: '', id_talla: '', id_color: '', precio_venta: '', codigo_barras: '', publicar_catalogo: true };

function Foto({ src, texto, onQuitar, portada }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl border border-[#F1D8E2] bg-[#FFF5F8]">
      <img src={src} alt={texto} className="h-full w-full object-cover" />
      {portada && <span className="absolute bottom-2 left-2 rounded-lg bg-[#FC4D84] px-2 py-1 text-[10px] font-bold text-white">Portada</span>}
      <button type="button" onClick={onQuitar} aria-label={`Quitar ${texto}`}
        className="absolute right-2 top-2 rounded-full bg-white p-2 text-[#C52D60] shadow-md hover:bg-[#FFF0F5]">
        <X size={16} />
      </button>
    </div>
  );
}

function Campo({ titulo, children, obligatorio = false }) {
  return (
    <div className="min-w-0">
      <label className="ld-form-label">{titulo} {obligatorio && <span className="text-[#FC4D84]">*</span>}</label>
      {children}
    </div>
  );
}

export default function EditarPrendaModal({ idPrenda, opciones, fotoUrl, onCerrar, onGuardado }) {
  const [form, setForm] = useState(vacio);
  const [fotosAnteriores, setFotosAnteriores] = useState([]);
  const [fotosNuevas, setFotosNuevas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [orientacion, setOrientacion] = useState('environment');
  const [camaraLista, setCamaraLista] = useState(false);
  const [camaraError, setCamaraError] = useState('');
  const videoRef = useRef(null);
  const maxActual = fotosAnteriores.length + fotosNuevas.length;

  const cargar = useCallback(async (signal) => {
    try {
      setCargando(true);
      setError('');
      const { data } = await api.get(`/inventario/prendas/${idPrenda}/editar`, { signal });
      const p = data.prenda;
      if (!p) throw new Error('No se encontró la prenda');
      setForm({
        nombre: p.nombre || '', descripcion: p.descripcion || '',
        id_categoria: String(p.id_categoria || ''), id_talla: String(p.id_talla || ''),
        id_color: String(p.id_color || ''), precio_venta: String(p.precio_venta ?? ''),
        codigo_barras: p.codigo_barras || '', publicar_catalogo: Boolean(p.publicar_catalogo),
      });
      setFotosAnteriores(p.fotos || []);
      setFotosNuevas([]);
    } catch (e) {
      if (e.code !== 'ERR_CANCELED') setError(e.response?.data?.mensaje || e.message || 'No se pudo cargar la prenda');
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [idPrenda]);

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, []);

  useEffect(() => {
    const cerrarConTecla = (e) => {
      if (e.key !== 'Escape' || guardando) return;
      if (camaraAbierta) setCamaraAbierta(false);
      else onCerrar();
    };
    window.addEventListener('keydown', cerrarConTecla);
    return () => window.removeEventListener('keydown', cerrarConTecla);
  }, [camaraAbierta, guardando, onCerrar]);

  const previews = useMemo(() => fotosNuevas.map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) })), [fotosNuevas]);
  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

  const cambiar = (campo, valor) => setForm((anterior) => ({ ...anterior, [campo]: valor }));
  const validarArchivos = (archivos) => {
    if (archivos.some((a) => !formatos.has(a.type) || a.size > 6 * 1024 * 1024)) {
      Swal.fire('Fotografía no válida', 'Solo JPG, PNG o WebP, máximo 6 MB por imagen.', 'warning');
      return false;
    }
    if (maxActual + archivos.length > maxFotos) {
      Swal.fire('Máximo cuatro imágenes', 'Elimina una fotografía antes de agregar otra.', 'warning');
      return false;
    }
    return true;
  };
  const agregarArchivos = (e) => {
    const archivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (archivos.length && validarArchivos(archivos)) setFotosNuevas((a) => [...a, ...archivos]);
  };

  useEffect(() => {
    if (!camaraAbierta) return;
    let activo = true;
    let stream;
    const video = videoRef.current;
    const iniciar = async () => {
      setCamaraLista(false);
      setCamaraError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamaraError('La cámara requiere localhost o HTTPS. Puedes cargar fotos desde tu dispositivo.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: orientacion } }, audio: false });
        if (!activo) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (!video) throw new Error('No se encontró el video');
        video.srcObject = stream;
        await video.play();
        if (activo) setCamaraLista(true);
      } catch (e) {
        if (activo) setCamaraError(e.name === 'NotAllowedError' ? 'Permite el uso de la cámara en tu navegador.' : 'No fue posible abrir la cámara.');
      }
    };
    iniciar();
    return () => {
      activo = false;
      stream?.getTracks().forEach((t) => t.stop());
      if (video) { video.pause(); video.srcObject = null; }
    };
  }, [camaraAbierta, orientacion]);

  const capturar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || maxActual >= maxFotos) return;
    const escala = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const archivo = new File([blob], `ludarope_${Date.now()}.jpg`, { type: 'image/jpeg' });
      if (!validarArchivos([archivo])) return;
      setFotosNuevas((a) => [...a, archivo]);
      setCamaraAbierta(false);
    }, 'image/jpeg', 0.84);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    if (!form.nombre.trim() || !form.id_categoria || !form.id_talla || !form.id_color ||
        !Number.isFinite(Number(form.precio_venta)) || Number(form.precio_venta) <= 0) {
      return Swal.fire('Datos incompletos', 'Revisa nombre, categoría, talla, color y precio.', 'warning');
    }
    const codigo = String(form.codigo_barras || '').trim().toUpperCase();
    if (codigo && !/^[A-Z0-9._-]{3,80}$/.test(codigo)) {
      return Swal.fire('Código de barras inválido', 'Usa de 3 a 80 caracteres: letras, números, guiones, punto o guion bajo.', 'warning');
    }
    if (maxActual > maxFotos) return;
    try {
      setGuardando(true);
      const datos = new FormData();
      datos.append('nombre', form.nombre.trim());
      datos.append('descripcion', form.descripcion.trim());
      datos.append('id_categoria', form.id_categoria);
      datos.append('id_talla', form.id_talla);
      datos.append('id_color', form.id_color);
      datos.append('precio_venta', form.precio_venta);
      datos.append('codigo_barras', codigo);
      datos.append('publicar_catalogo', String(form.publicar_catalogo));
      datos.append('fotos_conservar', JSON.stringify(fotosAnteriores.map((f) => Number(f.id_foto))));
      fotosNuevas.forEach((archivo) => datos.append('fotos', archivo));
      await api.put(`/inventario/prendas/${idPrenda}`, datos);
      await onGuardado();
      await Swal.fire({ icon: 'success', title: 'Prenda actualizada', text: 'Datos y fotografías guardados.', timer: 1300, showConfirmButton: false });
      onCerrar();
    } catch (e) {
      Swal.fire('No se pudo actualizar', e.response?.data?.mensaje || 'Revisa la conexión con el servidor.', 'error');
    } finally { setGuardando(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-[#241D28]/75 p-2 backdrop-blur-sm sm:p-5" role="presentation">
      <section className="ld-inventory flex max-h-[97dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.6rem] bg-white shadow-2xl sm:max-h-[94dvh] sm:rounded-[2rem]" role="dialog" aria-modal="true" aria-label="Editar prenda">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#F2E2E8] bg-[#FFFAFC] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-xl bg-[#FFF0F5] p-2.5 text-[#FC4D84]"><Pencil size={21} /></span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold text-[#352A30] sm:text-xl">Editar prenda</h2>
              <p className="text-xs text-[#9C8390]">LDR-{String(idPrenda).padStart(6, '0')} · Cambia datos y fotografías</p>
            </div>
          </div>
          <button type="button" disabled={guardando} onClick={onCerrar} aria-label="Cerrar" className="rounded-xl bg-white p-2.5 text-[#8F6D7A] hover:bg-[#FFEAF1] disabled:opacity-50"><X size={20} /></button>
        </div>

        {cargando ? <div className="flex flex-1 items-center justify-center gap-2 p-12 text-[#846D78]"><Loader2 className="animate-spin" /> Cargando información...</div>
        : error ? <div className="flex-1 p-6"><p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p><button type="button" onClick={() => cargar()} className="mt-4 rounded-xl bg-[#FC4D84] px-4 py-2 font-bold text-white">Reintentar</button></div>
        : <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
              <div className="min-w-0 space-y-4">
                <div className="flex items-center gap-2"><Shirt className="text-[#FC4D84]" size={19}/><h3 className="font-extrabold">Información de la prenda</h3></div>
                <Campo titulo="Nombre" obligatorio><input className={claseCampo} maxLength={180} value={form.nombre} onChange={(e) => cambiar('nombre', e.target.value)} /></Campo>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Categoría', 'id_categoria', opciones.categorias],
                    ['Talla', 'id_talla', opciones.tallas],
                    ['Color', 'id_color', opciones.colores],
                  ].map(([titulo, campo, items]) => (
                    <Campo key={campo} titulo={titulo} obligatorio>
                      <select className={claseCampo} value={form[campo]} onChange={(e) => cambiar(campo, e.target.value)}>
                        <option value="">Selecciona</option>
                        {(items || []).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                        {form[campo] && !(items || []).some((o) => String(o.id) === String(form[campo])) && (
                          <option value={form[campo]}>Opción registrada (inactiva)</option>
                        )}
                      </select>
                    </Campo>
                  ))}
                </div>
                <Campo titulo="Precio de venta" obligatorio>
                  <input className={claseCampo} type="number" min="0.01" step="0.01" value={form.precio_venta} onChange={(e) => cambiar('precio_venta', e.target.value)} />
                </Campo>
                <Campo titulo="Código de barras (opcional)">
                  <div className="relative">
                    <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C66B90]" size={19} />
                    <input className={`${claseCampo} ld-field-with-icon`} maxLength={80} autoComplete="off" value={form.codigo_barras} onChange={(e) => cambiar('codigo_barras', e.target.value)} placeholder="Escribe o escanea un código" />
                  </div>
                </Campo>
                <Campo titulo="Descripción (opcional)">
                  <textarea className={claseCampo} rows={4} maxLength={1500} value={form.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} placeholder="Material, detalles o condición de la prenda..." />
                </Campo>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#FFF5F8] p-4">
                  <input type="checkbox" checked={form.publicar_catalogo} onChange={(e) => cambiar('publicar_catalogo', e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#FC4D84]" />
                  <span><span className="block text-sm font-bold">Publicar en catálogo digital</span><span className="text-xs text-[#9B8390]">La prenda solo será visible si tiene stock y fotografías.</span></span>
                </label>
                <p className="rounded-xl border border-[#F5E5CD] bg-[#FFFAF2] p-3 text-xs text-[#82673C]">Las existencias se modifican con <b>Ajustar stock</b>. El costo de compra se administra en su módulo privado; aquí no se altera ninguno de los dos.</p>
              </div>

              <div className="min-w-0 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><ImagePlus size={20} className="text-[#FE714B]" /><h3 className="font-extrabold">Fotografías</h3></div>
                  <span className="rounded-full bg-[#FFF0F5] px-3 py-1 text-xs font-bold text-[#C53B6B]">{maxActual} / {maxFotos}</span>
                </div>
                <p className="text-xs leading-relaxed text-[#947D88]">Conserva las fotos existentes o quita las que quieras reemplazar. La eliminación se aplicará únicamente al guardar.</p>
                <div className="grid grid-cols-2 gap-3">
                  {fotosAnteriores.map((foto, indice) => (
                    <Foto key={foto.id_foto} src={fotoUrl(foto.ruta)} texto={`fotografía guardada ${indice + 1}`}
                      portada={indice === 0} onQuitar={() => setFotosAnteriores((a) => a.filter((f) => f.id_foto !== foto.id_foto))}/>
                  ))}
                  {previews.map(({ archivo, url }, indice) => (
                    <Foto key={url} src={url} texto={`nueva fotografía ${indice + 1}`} portada={fotosAnteriores.length === 0 && indice === 0}
                      onQuitar={() => setFotosNuevas((a) => a.filter((f) => f !== archivo))}/>
                  ))}
                  {Array.from({ length: Math.max(0, maxFotos - maxActual) }, (_, i) => (
                    <div key={`espacio-${i}`} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#F2D6E0] bg-[#FFF9FB] text-[#CB98AA]"><ImagePlus size={24}/><span className="text-xs">Foto {maxActual + i + 1}</span></div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={maxActual >= maxFotos || guardando} onClick={() => setCamaraAbierta(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-3 py-3 text-sm font-bold text-white hover:bg-[#EA3A72] disabled:opacity-40"><Camera size={18}/> Tomar foto</button>
                  <label className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#EFBCD0] bg-[#FFF5F8] px-3 py-3 text-sm font-bold text-[#C53B6B] ${maxActual >= maxFotos || guardando ? 'pointer-events-none opacity-40' : 'cursor-pointer'}`}>
                    <ImagePlus size={18}/> Subir foto
                    <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" multiple disabled={maxActual >= maxFotos || guardando} onChange={agregarArchivos}/>
                  </label>
                </div>
                <p className="text-xs text-[#9B8390]">JPG, PNG y WebP · máximo 6 MB cada una · hasta cuatro fotografías en total.</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#F1E2E8] bg-[#FFFAFC] p-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" disabled={guardando} onClick={onCerrar} className="rounded-xl border border-[#F0D8E2] bg-white px-5 py-3 text-sm font-bold text-[#7B6670] disabled:opacity-40">Cancelar</button>
            <button type="submit" disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC4D84] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#E83A71] disabled:opacity-40">
              {guardando ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>}
      </section>

      {camaraAbierta && <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#231822]/90 p-3" role="dialog" aria-modal="true" aria-label="Tomar fotografía">
        <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-[#352A30]">Tomar fotografía</h3><button type="button" onClick={() => setCamaraAbierta(false)} aria-label="Cerrar cámara"><X /></button></div>
          <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] max-h-[55vh] w-full rounded-xl bg-black object-contain" />
          {camaraError && <p className="mt-2 text-sm text-red-600">{camaraError}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOrientacion((a) => a === 'environment' ? 'user' : 'environment')} className="flex items-center gap-2 rounded-xl border p-3 text-sm"><RefreshCw size={16}/> Cambiar cámara</button>
            <button type="button" disabled={!camaraLista} onClick={capturar} className="flex items-center gap-2 rounded-xl bg-[#FC4D84] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><Camera size={17}/> Capturar</button>
          </div>
        </div>
      </div>}
    </div>, document.body
  );
}
