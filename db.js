require('dotenv').config();
const { Pool } = require('pg');

// Configuración de la conexión a Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Probamos la conexión al iniciar
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error al conectar con la base de datos Neon:', err.message);
    } else {
        console.log('✅ Conectado exitosamente a la base de datos Neon');
    }
    if (client) release(); // Liberamos el cliente
});

// Exportamos el pool para usarlo en otras partes del proyecto
module.exports = pool;