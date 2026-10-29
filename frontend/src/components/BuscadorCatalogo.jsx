import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';

const normalizar = (texto) => String(texto || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toLocaleLowerCase('es-MX');

export default function BuscadorCatalogo({
  titulo,
  opciones = [],
  valor,
  alCambiar,
  agregar,
  desactivar,
  administrador = false,
  reinicio = 0,
  placeholder = 'Escribe para buscar o crear...',
}) {
  const contenedor = useRef(null);
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const seleccionada = opciones.find((item) => String(item.id) === String(valor));

  useEffect(() => {
    setTexto('');
    setAbierto(false);
  }, [reinicio]);

  useEffect(() => {
    if (seleccionada) setTexto(seleccionada.nombre);
  }, [valor, seleccionada?.nombre]);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarAlSalir = (evento) => {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false);
    };
    document.addEventListener('pointerdown', cerrarAlSalir);
    return () => document.removeEventListener('pointerdown', cerrarAlSalir);
  }, [abierto]);

  const filtradas = useMemo(() => opciones
    .filter((item) => normalizar(item.nombre).includes(normalizar(texto)))
    .slice(0, 10), [opciones, texto]);
  const existe = opciones.some((item) => normalizar(item.nombre) === normalizar(texto));
  const puedeCrear = texto.trim().length > 0 && !existe;

  const seleccionar = (item) => {
    alCambiar(String(item.id));
    setTexto(item.nombre);
    setAbierto(false);
  };

  const crear = async () => {
    if (!puedeCrear || procesando) return;
    try {
      setProcesando(true);
      const item = await agregar(texto.trim());
      seleccionar(item);
    } catch {
      // El formulario padre ya muestra el error mediante SweetAlert.
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div ref={contenedor} className={`relative min-w-0 ${abierto ? 'z-40' : 'z-0'}`}>
      <label className="mb-2 block text-xs font-bold text-[#65535B]">
        {titulo} <span className="text-[#FC4D84]">*</span>
      </label>

      {/* Flex real: el icono y el texto nunca se enciman, aunque haya CSS global. */}
      <div className={`ld-combobox ${abierto ? 'ld-combobox-open' : ''}`}>
        <Search size={18} className="ld-combo-icon" aria-hidden="true" />
        <input
          type="text"
          className="ld-combo-input"
          role="combobox"
          aria-expanded={abierto}
          aria-haspopup="listbox"
          aria-label={`Buscar ${titulo.toLowerCase()}`}
          autoComplete="off"
          value={texto}
          placeholder={placeholder}
          onFocus={() => setAbierto(true)}
          onChange={(evento) => {
            setTexto(evento.target.value);
            alCambiar('');
            setAbierto(true);
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') setAbierto(false);
            if (evento.key === 'Enter') {
              evento.preventDefault();
              if (filtradas.length === 1 && !puedeCrear) seleccionar(filtradas[0]);
              else if (puedeCrear) crear();
            }
          }}
        />
        <button
          type="button"
          className="ld-combo-toggle"
          aria-label={`Mostrar opciones de ${titulo.toLowerCase()}`}
          aria-expanded={abierto}
          onClick={() => setAbierto((estado) => !estado)}
        >
          <ChevronDown size={18} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {abierto && (
        <div className="ld-combo-dropdown" role="listbox">
          {filtradas.map((item) => (
            <div key={item.id} className="flex min-w-0 items-center gap-1 rounded-xl hover:bg-[#FFF1F5]">
              <button
                type="button"
                role="option"
                aria-selected={String(item.id) === String(valor)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#4E3B44]"
                onClick={() => seleccionar(item)}
              >
                <Check size={15} className={`shrink-0 ${String(item.id) === String(valor) ? 'text-[#FC4D84]' : 'text-transparent'}`} />
                <span className="truncate">{item.nombre}</span>
              </button>
              {administrador && (
                <button
                  type="button"
                  className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#A68D97] hover:bg-[#FFE6EE] hover:text-[#CF3169]"
                  aria-label={`Desactivar ${item.nombre}`}
                  title={`Desactivar ${item.nombre}`}
                  onClick={() => desactivar(item)}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {filtradas.length === 0 && <p className="px-3 py-2 text-xs text-[#9D8790]">No se encontraron coincidencias.</p>}
          {puedeCrear && (
            <button
              type="button"
              disabled={procesando}
              onClick={crear}
              className="mt-1 flex w-full items-center gap-2 rounded-xl bg-[#FFF0F5] px-3 py-3 text-left text-sm font-bold text-[#DB356E] hover:bg-[#FFE4ED] disabled:opacity-50"
            >
              {procesando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              <span className="min-w-0 break-words">Agregar «{texto.trim()}»</span>
            </button>
          )}
          <div className="mt-2 border-t border-[#F6E7EB] pt-2 text-center">
            <button type="button" onClick={() => setAbierto(false)} className="px-3 py-1 text-xs font-semibold text-[#99828C]">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
