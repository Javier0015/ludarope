import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import AppLayout from './layouts/AppLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/admin/Dashboard';
import Inventario from './pages/inventario/Inventario';
import CostosPrendas from './pages/inventario/CostosPrendas';
import CatalogoDigital from './pages/publico/CatalogoDigital';
import ModuloPendiente from './pages/shared/ModuloPendiente';
import POS from './pages/ventas/POS';
import AdministrarCajas from './pages/cajas/AdministrarCajas';
import Caja from './pages/cajas/Caja';
import Usuarios from './pages/usuarios/Usuarios';
import Sucursales from './pages/sucursales/Sucursales';
import HistorialVentas from './pages/ventas/HistorialVentas';
import Configuracion from './pages/configuracion/Configuracion';
import Ofertas from './pages/ofertas/Ofertas';

function RutaInicial() {
  const { usuario, cargandoSesion } = useAuth();

  if (cargandoSesion) {
    return <p className="p-8 text-center text-[#FC4D84]">Validando sesión...</p>;
  }

  if (!usuario) return <Login />;
  return <Navigate to={usuario.rol === 'CAJERO' ? '/app/pos' : '/app/dashboard'} replace />;
}

function InicioAplicacion() {
  const { usuario } = useAuth();
  return <Navigate to={usuario?.rol === 'CAJERO' ? '/app/pos' : '/app/dashboard'} replace />;
}

function SoloAdmin({ children }) {
  return <RutaProtegida roles={['ADMIN']}>{children}</RutaProtegida>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RutaInicial />} />
      <Route path="/catalogo" element={<CatalogoDigital />} />

      <Route
        path="/app"
        element={
          <RutaProtegida roles={['ADMIN', 'CAJERO']}>
            <AppLayout />
          </RutaProtegida>
        }
      >
        <Route index element={<InicioAplicacion />} />
        <Route path="dashboard" element={<SoloAdmin><Dashboard /></SoloAdmin>} />
        <Route path="pos" element={<POS />} />
        <Route path="caja" element={<RutaProtegida roles={['ADMIN', 'CAJERO']}><Caja /></RutaProtegida>} />
        <Route path="configuracion-cajas" element={<SoloAdmin><AdministrarCajas /></SoloAdmin>} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="costos" element={<SoloAdmin><CostosPrendas /></SoloAdmin>} />
        <Route path="stock-sucursales" element={<SoloAdmin><ModuloPendiente titulo="Stock por sucursal" /></SoloAdmin>} />
        <Route path="categorias" element={<SoloAdmin><ModuloPendiente titulo="Categorías" /></SoloAdmin>} />
        <Route path="ofertas" element={<RutaProtegida roles={['ADMIN', 'CAJERO']}><Ofertas /></RutaProtegida>} />
        <Route path="ventas" element={<RutaProtegida roles={['ADMIN', 'CAJERO']}><HistorialVentas /></RutaProtegida>} />
        <Route path="sucursales" element={<SoloAdmin><Sucursales /></SoloAdmin>} />
        <Route path="usuarios" element={<SoloAdmin><Usuarios /></SoloAdmin>} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
