
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida({
  children,
  roles = []
}) {
  const { usuario, cargandoSesion } = useAuth();

  if (cargandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Validando sesión...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  if (
    roles.length > 0 &&
    !roles.includes(usuario.rol)
  ) {
    const destino = usuario.rol === 'CAJERO'
      ? '/app/pos'
      : '/app/dashboard';

    return <Navigate to={destino} replace />;
  }

  return children;
}
