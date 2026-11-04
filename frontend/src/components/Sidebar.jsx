
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Shirt,
  Store,
  ReceiptText,
  Wallet,
  Users,
  Settings,
  LockKeyhole,
  Images,
  ChevronRight,
  LogOut,
  ShieldCheck,
  UserRound,
  BadgePercent,
  SlidersHorizontal,
} from 'lucide-react';

import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

// ================================================
// MENÚ PRINCIPAL LUDAROPE POS
// ================================================
// ADMIN: acceso a los módulos administrativos.
// CAJERO: punto de venta, inventario, historial de ventas y caja.
//
// Los permisos del backend deben validarse
// independientemente de los enlaces visibles.
// ================================================

const SECCIONES = [
  {
    id: 'principal',
    titulo: 'Principal',
    enlaces: [
      {
        to: '/app/dashboard',
        texto: 'Dashboard',
        icono: LayoutDashboard,
        roles: ['ADMIN'],
      },
      {
        to: '/app/pos',
        texto: 'Punto de venta',
        icono: ShoppingCart,
        roles: ['ADMIN', 'CAJERO'],
      },
    ],
  },

  {
    id: 'inventario',
    titulo: 'Inventario',
    enlaces: [
      {
        to: '/app/inventario',
        texto: 'Inventario de prendas',
        icono: Shirt,
        roles: ['ADMIN', 'CAJERO'],
      },
      {
        to: '/app/costos',
        texto: 'Costos de compra',
        icono: LockKeyhole,
        roles: ['ADMIN'],
      },
      {
        to: '/catalogo',
        texto: 'Catálogo digital',
        icono: Images,
        roles: ['ADMIN', 'CAJERO'],
      },
    ],
  },

  {
    id: 'ventas',
    titulo: 'Ventas y caja',
    enlaces: [
      {
        to: '/app/ventas',
        texto: 'Historial de ventas',
        icono: ReceiptText,
        roles: ['ADMIN', 'CAJERO'],
      },
      {
        to: '/app/ofertas',
        texto: 'Ofertas y promociones',
        icono: BadgePercent,
        roles: ['ADMIN', 'CAJERO'],
      },
      {
        to: '/app/caja',
        texto: 'Caja',
        icono: Wallet,
        roles: ['ADMIN', 'CAJERO'],
      },
    ],
  },

  {
    id: 'administracion',
    titulo: 'Administración',
    enlaces: [
      {
        to: '/app/sucursales',
        texto: 'Sucursales',
        icono: Store,
        roles: ['ADMIN'],
      },
      {
        to: '/app/usuarios',
        texto: 'Usuarios',
        icono: Users,
        roles: ['ADMIN'],
      },
      {
        to: '/app/configuracion-cajas',
        texto: 'Configuración de cajas',
        icono: SlidersHorizontal,
        roles: ['ADMIN'],
      },
      {
        to: '/app/configuracion',
        texto: 'Configuración general',
        icono: Settings,
        roles: ['ADMIN'],
      },
    ],
  },
];

// ================================================
// COMPONENTE SIDEBAR
// ================================================

export default function Sidebar({
  onNavigate = () => {},
}) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const rol = String(usuario?.rol || '')
    .trim()
    .toUpperCase();

  // Mostrar únicamente los enlaces permitidos.
  const seccionesVisibles = SECCIONES
    .map((seccion) => ({
      ...seccion,
      enlaces: seccion.enlaces.filter((enlace) =>
        enlace.roles.includes(rol)
      ),
    }))
    .filter((seccion) => seccion.enlaces.length > 0);

  // ==============================================
  // CERRAR SESIÓN
  // ==============================================

  function salir() {
    logout();
    onNavigate();
    navigate('/', { replace: true });
  }

  // ==============================================
  // INTERFAZ
  // ==============================================

  return (
    <aside
      aria-label="Navegación principal"
      className="
        relative flex h-full min-h-0 w-full
        flex-col overflow-hidden border-r
        border-white/10 bg-[#241D28] text-white
      "
    >
      {/* Fondo decorativo */}

      <div
        className="
          pointer-events-none absolute inset-0
          overflow-hidden
        "
        aria-hidden="true"
      >
        <div
          className="
            absolute -right-40 -top-44
            h-80 w-80 rounded-full
            bg-[#FC4D84]/15 blur-3xl
          "
        />

        <div
          className="
            absolute -bottom-48 -left-40
            h-80 w-80 rounded-full
            bg-[#FF751F]/10 blur-3xl
          "
        />
      </div>

      {/* ========================================== */}
      {/* IDENTIDAD DE LUDAROPE */}
      {/* ========================================== */}

      <div
        className="
          relative z-10 flex h-[88px] shrink-0
          items-center gap-3 border-b
          border-white/10 px-5
        "
      >
        <span
          className="
            flex h-12 w-12 shrink-0
            items-center justify-center
            overflow-hidden rounded-2xl bg-white
            shadow-[0_12px_25px_rgba(252,77,132,0.20)]
          "
        >
          <img
            src={logo}
            alt="LUDAROPE"
            className="h-full w-full object-contain p-1"
          />
        </span>

        <div className="min-w-0">
          <h1
            className="
              truncate text-base
              font-black tracking-tight
            "
          >
            LUDAROPE POS
          </h1>

          <p
            className="
              mt-0.5 text-[10px] font-semibold
              uppercase tracking-[0.14em]
              text-[#E7AA44]
            "
          >
            Sistema de venta de ropa
          </p>
        </div>
      </div>

      {/* ========================================== */}
      {/* MENÚ DE NAVEGACIÓN */}
      {/* ========================================== */}

      <nav
        className="
          ludarope-sidebar-scroll
          relative z-10 min-h-0 flex-1
          space-y-6 overflow-y-auto
          overflow-x-hidden overscroll-contain
          px-3 py-5
        "
      >
        {seccionesVisibles.map((seccion) => (
          <div key={seccion.id}>
            {/* Título de sección */}

            <p
              className="
                mb-2 px-3 text-[10px]
                font-extrabold uppercase
                tracking-[0.15em]
                text-[#BBA9BB]
              "
            >
              {seccion.titulo}
            </p>

            {/* Enlaces */}

            <div className="space-y-1">
              {seccion.enlaces.map(
                ({ to, texto, icono: Icono }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `
                        group relative flex min-w-0
                        items-center gap-3 rounded-2xl
                        px-3 py-2.5 text-[13px]
                        font-semibold transition-all
                        duration-200
                        focus-visible:outline-2
                        focus-visible:outline-offset-2
                        focus-visible:outline-[#E7AA44]
                        ${
                          isActive
                            ? `
                              bg-[#FC4D84]
                              text-white
                              shadow-[0_8px_22px_rgba(252,77,132,0.24)]
                            `
                            : `
                              text-[#E0D9DF]
                              hover:bg-white/10
                              hover:text-white
                            `
                        }
                      `
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icono
                          size={19}
                          strokeWidth={1.8}
                          className="
                            shrink-0 transition-transform
                            duration-200
                            group-hover:scale-110
                          "
                        />

                        <span
                          className="
                            min-w-0 flex-1 truncate
                          "
                        >
                          {texto}
                        </span>

                        {isActive && (
                          <ChevronRight
                            size={16}
                            className="shrink-0"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* ========================================== */}
      {/* USUARIO ACTIVO */}
      {/* ========================================== */}

      <div
        className="
          relative z-10 shrink-0
          border-t border-white/10
          bg-[#211922]/90 p-4
        "
      >
     

        {/* ======================================== */}
        {/* CERRAR SESIÓN */}
        {/* ======================================== */}

        <button
          type="button"
          onClick={salir}
          className="
            mt-3 flex w-full items-center
            justify-center gap-2 rounded-xl
            border border-white/15 bg-white/10
            px-4 py-2.5 text-sm font-bold
            text-white transition-all duration-200
            hover:border-[#FC4D84]
            hover:bg-[#FC4D84]/20
            focus-visible:outline-2
            focus-visible:outline-[#E7AA44]
          "
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
