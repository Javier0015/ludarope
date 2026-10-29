
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();


const sucursalesRoutes = require('./routes/sucursalesRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const path = require('path');

const inventarioRoutes = require('./routes/inventarioRoutes');
const catalogoDigitalRoutes = require('./routes/catalogoDigitalRoutes');
const posRoutes = require('./routes/posRoutes');
const cajasAdminRoutes = require('./routes/cajasAdminRoutes');
const cajaRoutes = require('./routes/cajaRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const sucursalesAdminRoutes = require('./routes/sucursalesAdminRoutes');
const ventasHistorialRoutes = require('./routes/ventasHistorialRoutes');
const configuracionRoutes = require('./routes/configuracionRoutes');
const promocionesRoutes = require('./routes/promocionesRoutes');



const origenesPermitidos = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175'
];

app.use(cors({
  origin: origenesPermitidos,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pos', posRoutes);

app.use('/api/admin/cajas', cajasAdminRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/admin/sucursales', sucursalesAdminRoutes);
app.use('/api/admin/ventas', ventasHistorialRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/promociones', promocionesRoutes);





app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '../uploads'))
);

app.use('/api/inventario', inventarioRoutes);
app.use('/api/catalogo', catalogoDigitalRoutes);


// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Estado de la API
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'API LUDAROPE funcionando'
  });
});

// Comprobar PostgreSQL
app.get('/api/test-db', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        NOW() AS fecha_servidor,
        current_database() AS base_datos
    `);

    res.json({
      ok: true,
      mensaje: 'Conexión PostgreSQL exitosa',
      datos: resultado.rows[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error al conectar con PostgreSQL'
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API LUDAROPE en puerto ${PORT}`);
});
