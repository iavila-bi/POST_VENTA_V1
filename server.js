console.log("ðŸ”¥ VERSION ACTUAL DEL SERVER CARGADA");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// ======================================================
// CONFIGURACIÃ“N
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

app.get('/api/cierre-actas/pendientes', async (req, res) => {
    try {
        const { id_proyecto, q } = req.query;
        const where = ['rf.fecha_firma_acta IS NULL'];
        const params = [];

        if (id_proyecto) {
            params.push(id_proyecto);
            where.push(`i.id_proyecto = $${params.length}`);
        }

        if (q) {
            params.push(`%${q.trim()}%`);
            where.push(`(
                p.nombre_proyecto ILIKE $${params.length}
                OR i.numero_identificador::text ILIKE $${params.length}
                OR c.nombre_completo ILIKE $${params.length}
                OR f.nombre_familia ILIKE $${params.length}
                OR sf.nombre_subfamilia ILIKE $${params.length}
                OR r.nombre_responsable ILIKE $${params.length}
                OR rf.recinto ILIKE $${params.length}
            )`);
        }

        const query = `
            SELECT
                rf.id_registro,
                pv.id_postventa,
                p.id_proyecto,
                p.nombre_proyecto,
                i.numero_identificador,
                c.nombre_completo AS cliente,
                f.nombre_familia AS familia,
                sf.nombre_subfamilia AS subfamilia,
                rf.recinto,
                r.nombre_responsable AS responsable,
                rf.origen,
                rf.etiqueta_accion,
                rf.fecha_levantamiento,
                rf.fecha_visita
            FROM registros_familias rf
            JOIN postventas pv ON pv.id_postventa = rf.id_postventa
            JOIN inmuebles i ON i.id_inmueble = pv.id_inmueble
            JOIN proyectos p ON p.id_proyecto = i.id_proyecto
            JOIN clientes c ON c.id_cliente = pv.id_cliente
            LEFT JOIN familias f ON f.id_familia = rf.id_familia
            LEFT JOIN subfamilias sf ON sf.id_subfamilia = rf.id_subfamilia
            LEFT JOIN responsables r ON r.id_responsable = rf.id_responsable
            WHERE ${where.join(' AND ')}
            ORDER BY p.nombre_proyecto ASC, i.numero_identificador ASC, rf.fecha_levantamiento DESC, rf.id_registro DESC
        `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error cierre actas pendientes:', error);
        res.status(500).json({ error: 'Error al obtener registros pendientes de cierre' });
    }
});

app.put('/api/cierre-actas/:id_registro/firma-acta', async (req, res) => {
    try {
        const { id_registro } = req.params;
        const { fecha_firma_acta } = req.body;

        if (!fecha_firma_acta) {
            return res.status(400).json({ error: 'Fecha firma de acta es obligatoria' });
        }

        const result = await pool.query(
            `UPDATE registros_familias
             SET fecha_firma_acta = $1
             WHERE id_registro = $2
             RETURNING id_registro, fecha_firma_acta`,
            [fecha_firma_acta, id_registro]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        res.json({ success: true, registro: result.rows[0] });
    } catch (error) {
        console.error('Error actualizando fecha firma acta:', error);
        res.status(500).json({ error: 'Error al actualizar fecha firma de acta' });
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

app.get('/api/indicadores-postventa', async (req, res) => {
    try {
        const result = await pool.query(`
            WITH casas AS (
                SELECT COUNT(DISTINCT id_inmueble)::int AS total
                FROM postventas
            ),
            familias AS (
                SELECT COUNT(*)::int AS total
                FROM registros_familias
            ),
            tareas AS (
                SELECT COUNT(*)::int AS total
                FROM tareas
            )
            SELECT
                casas.total AS total_casas_con_pv,
                familias.total AS total_familias_acumuladas,
                CASE
                    WHEN casas.total = 0 THEN 0
                    ELSE ROUND(familias.total::numeric / casas.total, 2)
                END AS promedio_familias_por_casa,
                CASE
                    WHEN familias.total = 0 THEN 0
                    ELSE ROUND(tareas.total::numeric / familias.total, 2)
                END AS promedio_tareas_por_familia
            FROM casas, familias, tareas
        `);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error indicadores postventa:', error);
        res.status(500).json({ error: 'Error al obtener indicadores' });
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

        // 1ï¸âƒ£ Crear cliente
        const resCliente = await client.query(
            `INSERT INTO clientes (nombre_completo, numero_contacto)
             VALUES ($1, $2)
             RETURNING id_cliente`,
            [nombre_cliente, numero_contacto]
        );

        const id_cliente = resCliente.rows[0].id_cliente;

        // 2ï¸âƒ£ Crear postventa
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

app.get('/api/postventas/recientes', async (req, res) => {
    try {
        const dias = Number(req.query.dias || 7);
        const result = await pool.query(
            `SELECT DISTINCT ON (pv.id_inmueble)
                pv.id_postventa,
                pv.fecha_apertura,
                pv.estado,
                pv.id_inmueble,
                p.nombre_proyecto,
                i.numero_identificador,
                c.nombre_completo AS cliente,
                (
                    SELECT COUNT(*)::int
                    FROM registros_familias rf
                    WHERE rf.id_postventa = pv.id_postventa
                ) AS total_familias
             FROM postventas pv
             JOIN inmuebles i ON i.id_inmueble = pv.id_inmueble
             JOIN proyectos p ON p.id_proyecto = i.id_proyecto
             JOIN clientes c ON c.id_cliente = pv.id_cliente
              WHERE pv.fecha_apertura >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
              ORDER BY pv.id_inmueble, pv.fecha_apertura DESC, pv.id_postventa DESC`,
            [dias]
        );

        const ordenadas = result.rows.sort((a, b) => {
            const fa = new Date(a.fecha_apertura).getTime();
            const fb = new Date(b.fecha_apertura).getTime();
            if (fb !== fa) return fb - fa;
            return Number(b.id_postventa) - Number(a.id_postventa);
        });

        res.json(ordenadas);
    } catch (error) {
        console.error('Error postventas recientes:', error);
        res.status(500).json({ error: 'Error al obtener postventas recientes' });
    }
});

app.get('/api/postventas/:id_postventa/detalle', async (req, res) => {
    try {
        const { id_postventa } = req.params;
        const result = await pool.query(
            `SELECT
                pv.id_postventa,
                pv.id_inmueble,
                pv.estado AS estado_ticket,
                i.id_proyecto,
                p.nombre_proyecto,
                i.numero_identificador,
                c.nombre_completo AS cliente,
                c.numero_contacto,
                (
                    SELECT COUNT(*)::int
                    FROM registros_familias rf
                    WHERE rf.id_postventa = pv.id_postventa
                ) AS total_familias
             FROM postventas pv
             JOIN inmuebles i ON i.id_inmueble = pv.id_inmueble
             JOIN proyectos p ON p.id_proyecto = i.id_proyecto
             JOIN clientes c ON c.id_cliente = pv.id_cliente
             WHERE pv.id_postventa = $1`,
            [id_postventa]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Postventa no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error detalle postventa:', error);
        res.status(500).json({ error: 'Error al obtener detalle de la postventa' });
    }
});

app.get('/api/postventas/:id_postventa/familias-recientes', async (req, res) => {
    try {
        const { id_postventa } = req.params;
        const limite = Math.max(1, Math.min(Number(req.query.limit || 5), 20));
        const result = await pool.query(
            `SELECT
                f.nombre_familia AS familia,
                sf.nombre_subfamilia AS subfamilia,
                rf.recinto,
                rf.fecha_levantamiento AS levantamiento,
                r.nombre_responsable AS responsable,
                r.cargo AS cargo_responsable
             FROM registros_familias rf
             LEFT JOIN familias f ON f.id_familia = rf.id_familia
             LEFT JOIN subfamilias sf ON sf.id_subfamilia = rf.id_subfamilia
             LEFT JOIN responsables r ON r.id_responsable = rf.id_responsable
             WHERE rf.id_postventa = $1
             ORDER BY rf.id_registro DESC
             LIMIT $2`,
            [id_postventa, limite]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error familias recientes postventa:', error);
        res.status(500).json({ error: 'Error al obtener familias recientes de la postventa' });
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

    if (!registro?.etiqueta_accion) {
        return res.status(400).json({ error: 'Etiqueta acción es obligatoria' });
    }

    if (!Array.isArray(tareas) || tareas.length === 0) {
        return res.status(400).json({ error: 'Debe agregar al menos una tarea' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1ï¸âƒ£ Insertar registro_familias
        const resRegistro = await client.query(
            `INSERT INTO registros_familias
            (id_postventa, id_familia, id_subfamilia, id_responsable, origen, etiqueta_accion, recinto, comentarios_previos, fecha_levantamiento, fecha_visita, fecha_firma_acta)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING id_registro`,
            [
                registro.id_postventa,
                registro.id_familia,
                registro.id_subfamilia,
                registro.id_responsable,
                registro.origen,
                registro.etiqueta_accion,
                registro.recinto,
                registro.comentarios_previos,
                registro.fecha_levantamiento,
                registro.fecha_visita,
                registro.fecha_firma_acta || null
            ]
        );

        const id_registro = resRegistro.rows[0].id_registro;

        // 2ï¸âƒ£ Insertar tareas y ejecutantes
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
    console.log(`ðŸš€ Servidor corriendo en http://localhost:${PORT}`);
});

