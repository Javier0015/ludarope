
require('dotenv').config();

const bcrypt = require('bcryptjs');
const prompt = require('prompt-sync')({ sigint: true });
const pool = require('../src/config/db');

async function crearAdmin() {
  try {
    console.log('\n=== CREAR ADMINISTRADOR LUDAROPE ===\n');

    const nombre = prompt('Nombre: ').trim();
    const usuario = prompt('Usuario: ').trim();
    const password = prompt('Contraseña: ', { echo: '*' });

    if (!nombre || !usuario || !password) {
      throw new Error('Todos los campos son obligatorios');
    }

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const resultado = await pool.query(
      `INSERT INTO usuarios (
        nombre,
        usuario,
        password_hash,
        rol,
        id_sucursal,
        activo
      )
      VALUES ($1, $2, $3, 'ADMIN', NULL, TRUE)
      ON CONFLICT DO NOTHING
      RETURNING id_usuario, nombre, usuario, rol`,
      [nombre, usuario, passwordHash]
    );

    if (resultado.rowCount === 0) {
      console.log('El usuario ya existe.');
      return;
    }

    console.log('\nAdministrador creado correctamente');
    console.table(resultado.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

crearAdmin();
