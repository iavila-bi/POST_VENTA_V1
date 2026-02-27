console.log("🔥 VERSION ACTUAL DEL SERVER CARGADA");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// ======================================================
// CONFIGURACIÓN
// ======================================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ======================================================
// PROYECTOS E INMUEBLES
// ======================================================

app.get('/api/proyectos', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id_proyecto, nombre_proyecto FROM proyectos ORDER BY nombre_proyecto ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error proyectos:', error);
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
});

app.get('/api/proyectos/:id_proyecto/inmuebles', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM inmuebles WHERE id_proyecto = $1 ORDER BY numero_identificador ASC',
            [req.params.id_proyecto]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error inmuebles:', error);
        res.status(500).json({ error: 'Error al obtener inmuebles' });
    }
});

app.get('/api/inmuebles/detalle/:id_inmueble', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT casa_o_depto, modelo, orientacion, fecha_entrega 
             FROM inmuebles WHERE id_inmueble = $1`,
            [req.params.id_inmueble]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inmueble no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error detalle inmueble:', error);
        res.status(500).json({ error: 'Error al obtener detalle' });
    }
});

// ======================================================
// FAMILIAS / SUBFAMILIAS / RESPONSABLES / EJECUTANTES
// ======================================================

app.get('/api/familias', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id_familia, nombre_familia FROM familias ORDER BY nombre_familia ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error familias:', error);
        res.status(500).json({ error: 'Error al obtener familias' });
    }
});

app.get('/api/familias/:id_familia/subfamilias', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id_subfamilia, nombre_subfamilia FROM subfamilias WHERE id_familia = $1 ORDER BY nombre_subfamilia ASC',
            [req.params.id_familia]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error subfamilias:', error);
        res.status(500).json({ error: 'Error al obtener subfamilias' });
    }
});

app.get('/api/responsables', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id_responsable, nombre_responsable, cargo FROM responsables ORDER BY nombre_responsable ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error responsables:', error);
        res.status(500).json({ error: 'Error al obtener responsables' });
    }
});

app.get('/api/ejecutantes', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id_ejecutante, nombre_ejecutante, especialidad FROM ejecutantes ORDER BY nombre_ejecutante ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error ejecutantes:', error);
        res.status(500).json({ error: 'Error al obtener ejecutantes' });
    }
});

// ======================================================
// CREAR POSTVENTA
// ======================================================

app.post('/api/postventas/crear', async (req, res) => {
    const { id_inmueble, nombre_cliente, numero_contacto, estado_ticket } = req.body;

    if (!id_inmueble || !nombre_cliente) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1️⃣ Crear cliente
        const resCliente = await client.query(
            `INSERT INTO clientes (nombre_completo, numero_contacto)
             VALUES ($1, $2)
             RETURNING id_cliente`,
            [nombre_cliente, numero_contacto]
        );

        const id_cliente = resCliente.rows[0].id_cliente;

        // 2️⃣ Crear postventa
        const resPostventa = await client.query(
            `INSERT INTO postventas (id_inmueble, id_cliente, fecha_apertura, estado)
             VALUES ($1, $2, CURRENT_DATE, $3)
             RETURNING id_postventa`,
            [id_inmueble, id_cliente, estado_ticket]
        );

        const id_postventa = resPostventa.rows[0].id_postventa;

        await client.query('COMMIT');

        res.json({ id_postventa });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error crear postventa:', error);
        res.status(500).json({ error: 'Error al crear postventa' });
    } finally {
        client.release();
    }
});

// ======================================================
// GUARDAR FAMILIA + TAREAS + EJECUTANTES
// ======================================================

app.post('/api/guardar-familia-completa', async (req, res) => {
    const { registro, tareas } = req.body;

    if (!registro?.id_postventa || !registro?.id_familia) {
        return res.status(400).json({ error: 'Datos incompletos del registro' });
    }

    if (!Array.isArray(tareas) || tareas.length === 0) {
        return res.status(400).json({ error: 'Debe agregar al menos una tarea' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1️⃣ Insertar registro_familias
        const resRegistro = await client.query(
            `INSERT INTO registros_familias
            (id_postventa, id_familia, id_subfamilia, id_responsable, recinto, comentarios_previos, fecha_levantamiento, fecha_visita, fecha_firma_acta)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id_registro`,
            [
                registro.id_postventa,
                registro.id_familia,
                registro.id_subfamilia,
                registro.id_responsable,
                registro.recinto,
                registro.comentarios_previos,
                registro.fecha_levantamiento,
                registro.fecha_visita,
                registro.fecha_firma_acta
            ]
        );

        const id_registro = resRegistro.rows[0].id_registro;

        // 2️⃣ Insertar tareas y ejecutantes
        for (const t of tareas) {

            const resTarea = await client.query(
                `INSERT INTO tareas
                (id_registro_familia, descripcion_tarea, fecha_inicio, fecha_termino)
                VALUES ($1,$2,$3,$4)
                RETURNING id_tarea`,
                [id_registro, t.descripcion, t.inicio, t.termino]
            );

            const id_tarea = resTarea.rows[0].id_tarea;

            await client.query(
                `INSERT INTO tareas_ejecutantes (id_tarea, id_ejecutante)
                 VALUES ($1,$2)`,
                [id_tarea, 
                t.id_ejecutante]
            );
        }

        await client.query('COMMIT');

        res.json({ success: true, id_registro });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error guardado completo:', error);
        res.status(500).json({ error: 'Error al guardar registro completo' });
    } finally {
        client.release();
    }
});

// ======================================================
// SERVIDOR
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});