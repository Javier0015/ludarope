import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShieldCheck, Store, X } from 'lucide-react';

import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  useEffect(() => {
    setMenuMovilAbierto(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuMovilAbierto) return undefined;
    const onEscape = (e) => e.key === 'Escape' && setMenuMovilAbierto(false);
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menuMovilAbierto]);

  const cerrarSesion = () => {
    logout();
    navigate('/', { replace: true });
  };

  const esAdmin = usuario?.rol === 'ADMIN';

  return (
    <div className="flex h-[100dvh] w-full max-w-full min-w-0 overflow-hidden bg-[#F5F6F9] text-[#352A30]">
      {/* Sidebar a la izquierda, visible permanentemente en escritorio. */}
      <div className="hidden h-full w-[280px] flex-none lg:block" style={{ width: 280, flexBasis: 280 }}>
        <Sidebar />
      </div>

      {/* En celular se abre como panel lateral, no arriba del dashboard. */}
      {menuMovilAbierto && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 h-full w-full bg-[#231C28]/60 backdrop-blur-[2px]"
            onClick={() => setMenuMovilAbierto(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[calc(100vw-48px)] shadow-[18px_0_65px_rgba(26,18,29,.30)]">
            <Sidebar onNavigate={() => setMenuMovilAbierto(false)} />
          </div>
          <button
            type="button"
            aria-label="Cerrar menú lateral"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#FC4D84] shadow-lg"
            onClick={() => setMenuMovilAbierto(false)}
          >
            <X size={21} />
          </button>
        </div>
      )}

      {/* Header y contenido están a la derecha del sidebar. */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-[#E9EAF0] bg-white px-4 shadow-[0_3px_12px_rgba(34,26,40,.025)] sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menú lateral"
              aria-expanded={menuMovilAbierto}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#FC4D84] transition hover:bg-[#FFE2EB] lg:hidden"
              onClick={() => setMenuMovilAbierto(true)}
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#9B8690]">Sesión activa</p>
              <h2 className="truncate text-sm font-black text-[#352A30] sm:text-lg">
                Hola, {usuario?.nombre || 'Usuario'}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F5] text-[#FC4D84]">
                {esAdmin ? <ShieldCheck size={19} /> : <Store size={19} />}
              </span>
              <div className="hidden max-w-[150px] min-w-0 md:block">
                <p className="truncate text-xs font-extrabold text-[#352A30]">{esAdmin ? 'ADMIN' : 'CAJERO'}</p>
                <p className="truncate text-[11px] text-[#947F88]">
                  {esAdmin ? 'Todas las sucursales' : usuario?.sucursal || 'Sucursal asignada'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F4] text-[#FC4D84] transition hover:bg-[#FFE3E9] focus-visible:outline-2 focus-visible:outline-[#FC4D84]"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        {/* Solo el contenido baja al hacer scroll. El sidebar y header permanecen. */}
        <main
          id="contenido-principal"
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-[#F5F6F9] px-3 py-4 sm:px-5 sm:py-6 lg:px-7"
        >
          <div className="mx-auto w-full min-w-0 max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
