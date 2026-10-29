
import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';

import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // =========================================
  // RECUPERAR SESIÓN
  // =========================================
  useEffect(() => {
    let activo = true;

    const recuperarSesion = async () => {
      const token = sessionStorage.getItem('ludarope_token');

      if (!token) {
        if (activo) setCargandoSesion(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');

        if (activo) {
          setUsuario(data.usuario);
        }
      } catch (error) {
        console.error('Error recuperando sesión:', error);

        sessionStorage.removeItem('ludarope_token');

        if (activo) {
          setUsuario(null);
        }
      } finally {
        if (activo) setCargandoSesion(false);
      }
    };

    recuperarSesion();

    return () => {
      activo = false;
    };
  }, []);

  // =========================================
  // INICIAR SESIÓN
  // =========================================
  const login = async (usuarioLogin, password) => {
    const { data } = await api.post('/auth/login', {
      usuario: usuarioLogin,
      password
    });

    if (data.ok && data.token && data.usuario) {
      sessionStorage.setItem('ludarope_token', data.token);
      setUsuario(data.usuario);
    }

    return data;
  };

  // =========================================
  // CERRAR SESIÓN
  // =========================================
  const logout = () => {
    sessionStorage.removeItem('ludarope_token');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        login,
        logout,
        cargandoSesion,
        autenticado: !!usuario
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }

  return context;
}
