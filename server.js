require('dotenv').config(); // <-- 1. Esto lee tu archivo .env automáticamente
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// =======================================================================
// CONFIGURACIÓN (Middlewares y Base de Datos)
// =======================================================================
app.use(cors());
app.use(express.json()); 
app.use(express.static(__dirname)); // <-- 2. ESTO HACE QUE AL ENTRAR AL LOCALHOST SE VEA TU PÁGINA

// Conexión usando directamente tu variable del .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// =======================================================================
// RUTAS PARA LAS LISTAS DESPLEGABLES EN CASCADA
// =======================================================================

app.get('/api/proyectos', async (req, res) => {
    try {
        const query = 'SELECT * FROM proyectos ORDER BY nombre_proyecto ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
});

app.get('/api/proyectos/:id_proyecto/inmuebles', async (req, res) => {
    const { id_proyecto } = req.params;
    try {
        const query = 'SELECT * FROM inmuebles WHERE id_proyecto = $1 ORDER BY numero_identificador ASC';
        const result = await pool.query(query, [id_proyecto]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al buscar inmuebles:', error);
        res.status(500).json({ error: 'Error al buscar inmuebles' });
    }
});

app.get('/api/inmuebles/detalle/:id_inmueble', async (req, res) => {
    const { id_inmueble } = req.params;
    try {
        const query = 'SELECT casa_o_depto, modelo, orientacion, fecha_entrega FROM inmuebles WHERE id_inmueble = $1';
        const result = await pool.query(query, [id_inmueble]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Inmuebles no encontrados' });
        }
    } catch (error) {
        console.error('Error al buscar detalle del inmueble:', error);
        res.status(500).json({ error: 'Error al buscar el detalle del inmueble' });
    }
});

app.get('/api/familias', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM familias ORDER BY nombre_familia ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener familias:', error);
        res.status(500).json({ error: 'Error al obtener familias' });
    }
});

app.get('/api/familias/:id_familia/subfamilias', async (req, res) => {
    const { id_familia } = req.params;
    try {
        const query = 'SELECT * FROM subfamilias WHERE id_familia = $1 ORDER BY nombre_subfamilia ASC';
        const result = await pool.query(query, [id_familia]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al buscar subfamilias:', error);
        res.status(500).json({ error: 'Error al buscar subfamilias' });
    }
});

app.get('/api/ejecutantes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ejecutante ORDER BY nombre_ejecutante ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener ejecutantes:', error);
        res.status(500).json({ error: 'Error al obtener ejecutantes' });
    }
});

// =======================================================================
// RUTAS PARA CREAR LOS REGISTROS
// =======================================================================

app.post('/api/tickets', async (req, res) => {
    // ... tu código de tickets sigue igual ...
});

app.post('/api/tickets/:id_ticket/registros', async (req, res) => {
    // ... tu código de registros sigue igual ...
});

app.get('/api/tickets/hoy', async (req, res) => {
    // ... tu código de hoy sigue igual ...
});

// =======================================================================
// INICIAR EL SERVIDOR
// =======================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // <-- 3. AQUÍ ESTÁ EL ENLACE CLICKEABLE AZUL QUE QUERÍAS -->
    console.log(`🚀 Servidor corriendo sin problemas en: http://localhost:${PORT}`);
});