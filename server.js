require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// =======================================================================
// CONFIGURACIÓN (Middlewares y Base de Datos)
// =======================================================================
app.use(cors());
app.use(express.json()); 
app.use(express.static(__dirname)); 

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// =======================================================================
// RUTAS PARA LAS LISTAS DESPLEGABLES (IDENTIFICACIÓN)
// =======================================================================

app.get('/api/proyectos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM proyectos ORDER BY nombre_proyecto ASC');
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

// =======================================================================
// RUTAS PARA SECCIÓN 3 (FAMILIAS, SUBFAMILIAS Y RESPONSABLES)
// =======================================================================

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

// Usamos la tabla "responsables" para cargar a los Responsables
// Busca esta ruta en tu server.js y reemplázala
app.get('/api/responsables', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT id_responsable, nombre_responsable, cargo FROM responsables ORDER BY nombre_responsable ASC');
        // Enviamos las filas tal cual vienen de Neon
        res.json(resultado.rows); 
    } catch (err) {
        console.error("Error en BD responsables:", err.message);
        res.status(500).json([]);
    }
});

// =======================================================================
// RUTAS PARA CREAR REGISTROS (TICKETS Y TAREAS)
// =======================================================================

app.post('/api/tickets', async (req, res) => {
    // Aquí irá tu lógica de INSERT para el ticket global
});

app.post('/api/tickets/:id_ticket/registros', async (req, res) => {
    // Aquí irá tu lógica de INSERT para las tareas de la tabla
});

// =======================================================================
// INICIAR EL SERVIDOR
// =======================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo sin problemas en: http://localhost:${PORT}`);
});