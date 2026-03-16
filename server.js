console.log("ðŸ”¥ VERSION ACTUAL DEL SERVER CARGADA");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require("path");

const app = express();

// ======================================================
// CONFIGURACIÃ“N
// ======================================================
app.use(cors());
app.use(express.json());

// Landing: que lo primero sea el login
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

// Static: no servir index.html automáticamente en "/"
// (para que "/" siempre muestre login.html)
app.use(express.static(__dirname, { index: false }));

// Auth (login)
try {
    app.use("/api/auth", require("./routes/auth.routes"));
} catch (e) {
    console.warn("Auth no cargado:", e.message);
}

// ======================================================
// MODULOS: USUARIOS + AUDITORIA (JWT + RBAC)
// ======================================================
// Nota: estas rutas requieren JWT válido y rol admin.
try {
    app.use("/api/usuarios", require("./routes/usuarios.routes"));
    app.use("/api/auditoria", require("./routes/auditoria.routes"));
} catch (e) {
    // Si faltan deps (bcrypt/jsonwebtoken) o archivos, evitamos romper el server base.
    console.warn("Usuarios/Auditoría no cargados:", e.message);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    // Make connection issues fail fast instead of hanging requests indefinitely.
    // Neon/pgBouncer over the public internet can occasionally stall on auth/handshake.
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 15000),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    max: Number(process.env.PG_POOL_MAX || 5),
    keepAlive: true,
    keepAliveInitialDelayMillis: 0
});

pool.on("error", (err) => {
    // Unexpected errors on idle clients in the pool.
    console.error("PG pool error:", err);
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
                familias.total AS total_familias_acumsuladas,
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

// Listado histórico de postventas (para gestión/borrado), con filtros.
// Query params:
// - id_proyecto (opcional)
// - estado (opcional: "Abierta" | "Cerrada")
// - q (opcional: busca por id_postventa, cliente, proyecto, identificador)
// - limit (opcional, max 500)
app.get('/api/postventas/listado', async (req, res) => {
    try {
        const idProyecto = req.query.id_proyecto ? Number(req.query.id_proyecto) : null;
        const estado = req.query.estado ? String(req.query.estado).trim() : null;
        const q = req.query.q ? String(req.query.q).trim() : null;
        const limit = Math.max(1, Math.min(Number(req.query.limit || 200), 500));

        const where = [];
        const params = [];

        if (idProyecto && Number.isFinite(idProyecto)) {
            params.push(idProyecto);
            where.push(`p.id_proyecto = $${params.length}`);
        }

        if (estado) {
            params.push(estado);
            where.push(`pv.estado = $${params.length}`);
        }

        if (q) {
            params.push(`%${q}%`);
            where.push(`(
                pv.id_postventa::text ILIKE $${params.length}
                OR p.nombre_proyecto ILIKE $${params.length}
                OR i.numero_identificador::text ILIKE $${params.length}
                OR c.nombre_completo ILIKE $${params.length}
            )`);
        }

        params.push(limit);
        const clausulaWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const result = await pool.query(
            `SELECT
                pv.id_postventa,
                pv.fecha_apertura,
                pv.estado,
                p.id_proyecto,
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
             ${clausulaWhere}
             ORDER BY pv.id_postventa DESC
             LIMIT $${params.length}`,
            params
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error listado postventas:', error);
        res.status(500).json({ error: 'Error al listar postventas' });
    }
});

app.get('/api/postventas/:id_postventa/detalle', async (req, res) => {
    try {
        const { id_postventa } = req.params;

        const tieneEstadoInmueble = await inmueblesTieneEstadoInmueble(pool);
        const selectEstadoInmueble = tieneEstadoInmueble
            ? `i.estado_inmueble`
            : `NULL::text AS estado_inmueble`;

        const result = await pool.query(
            `SELECT
                pv.id_postventa,
                pv.id_inmueble,
                pv.estado AS estado_ticket,
                i.id_proyecto,
                p.nombre_proyecto,
                i.numero_identificador,
                ${selectEstadoInmueble},
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

        // Soporta BD con o sin columna `estado_tarea` (en algunas instalaciones no existe).
        // Si no existe, se deriva de `fecha_firma_acta`.
        const col = await pool.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'registros_familias'
               AND column_name = 'estado_tarea'
             LIMIT 1`
        );
        const tieneEstadoTarea = col.rowCount > 0;

        const selectEstado = tieneEstadoTarea
            ? `COALESCE(rf.estado_tarea, 'Pendiente') AS estado_tarea`
            : `CASE WHEN rf.fecha_firma_acta IS NOT NULL THEN 'Finalizado' ELSE 'Pendiente' END AS estado_tarea`;

        const result = await pool.query(
            `SELECT
                rf.id_registro,
                f.nombre_familia AS familia,
                sf.nombre_subfamilia AS subfamilia,
                rf.recinto,
                rf.fecha_levantamiento AS levantamiento,
                r.nombre_responsable AS responsable,
                r.cargo AS cargo_responsable,
                ${selectEstado}
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

app.get('/api/postventas/:id_postventa/registros', async (req, res) => {
    try {
        const { id_postventa } = req.params;

        const col = await pool.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'registros_familias'
               AND column_name = 'estado_tarea'
             LIMIT 1`
        );
        const tieneEstadoTarea = col.rowCount > 0;

        const selectEstado = tieneEstadoTarea
            ? `COALESCE(rf.estado_tarea, 'Pendiente') AS estado_tarea`
            : `CASE WHEN rf.fecha_firma_acta IS NOT NULL THEN 'Finalizado' ELSE 'Pendiente' END AS estado_tarea`;

        const result = await pool.query(
            `SELECT
                rf.id_registro,
                f.nombre_familia AS familia,
                sf.nombre_subfamilia AS subfamilia,
                rf.recinto,
                rf.fecha_levantamiento,
                r.nombre_responsable AS responsable,
                r.cargo AS cargo_responsable,
                ${selectEstado}
             FROM registros_familias rf
             LEFT JOIN familias f ON f.id_familia = rf.id_familia
             LEFT JOIN subfamilias sf ON sf.id_subfamilia = rf.id_subfamilia
             LEFT JOIN responsables r ON r.id_responsable = rf.id_responsable
             WHERE rf.id_postventa = $1
             ORDER BY rf.id_registro DESC`,
            [id_postventa]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo registros por postventa:', error);
        res.status(500).json({ error: 'Error al obtener registros de la postventa' });
    }
});

async function inmueblesTieneEstadoInmueble(client) {
    if (inmueblesTieneEstadoInmueble._cache !== undefined) return inmueblesTieneEstadoInmueble._cache;
    const q = await client.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'inmuebles'
           AND column_name = 'estado_inmueble'
         LIMIT 1`
    );
    inmueblesTieneEstadoInmueble._cache = q.rowCount > 0;
    return inmueblesTieneEstadoInmueble._cache;
}

// Editar postventa (sin salir del modal)
// Permite actualizar: id_inmueble, estado (ticket), nombre/telefono de cliente
// Opcional: estado_inmueble (si existe la columna en inmuebles)
app.put("/api/postventas/:id_postventa", async (req, res) => {
    const id_postventa = Number(req.params.id_postventa);
    const { id_inmueble, estado_ticket, nombre_cliente, numero_contacto, estado_inmueble } = req.body || {};

    if (!Number.isFinite(id_postventa) || id_postventa <= 0) {
        return res.status(400).json({ error: "ID inválido" });
    }

    if (!id_inmueble || !estado_ticket || !nombre_cliente) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const pv = await client.query(
            `SELECT id_postventa, id_cliente
             FROM postventas
             WHERE id_postventa = $1`,
            [id_postventa]
        );
        if (pv.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Postventa no encontrada" });
        }

        const id_cliente = pv.rows[0].id_cliente;

        await client.query(
            `UPDATE clientes
             SET nombre_completo = $1,
                 numero_contacto = $2
             WHERE id_cliente = $3`,
            [nombre_cliente, numero_contacto || null, id_cliente]
        );

        await client.query(
            `UPDATE postventas
             SET id_inmueble = $1,
                 estado = $2
             WHERE id_postventa = $3`,
            [id_inmueble, estado_ticket, id_postventa]
        );

        if (estado_inmueble !== undefined && estado_inmueble !== null) {
            const tieneCol = await inmueblesTieneEstadoInmueble(client);
            if (tieneCol) {
                await client.query(
                    `UPDATE inmuebles
                     SET estado_inmueble = $1
                     WHERE id_inmueble = $2`,
                    [estado_inmueble, id_inmueble]
                );
            }
        }

        await client.query("COMMIT");
        res.json({ success: true, id_postventa });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error editando postventa:", error);
        res.status(500).json({ error: "Error al editar postventa" });
    } finally {
        client.release();
    }
});

// ======================================================
// GESTION (REGISTROS -> TAREAS)
// ======================================================

// Devuelve detalle del registro de familia (para editar)
app.get('/api/registros-familia/:id_registro/detalle', async (req, res) => {
    try {
        const id_registro = Number(req.params.id_registro);
        if (!Number.isFinite(id_registro) || id_registro <= 0) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        const result = await pool.query(
            `SELECT
                rf.id_registro,
                rf.id_postventa,
                rf.id_familia,
                rf.id_subfamilia,
                rf.id_responsable,
                rf.origen,
                rf.etiqueta_accion,
                rf.recinto,
                rf.comentarios_previos,
                rf.fecha_levantamiento,
                rf.fecha_visita,
                rf.fecha_firma_acta
             FROM registros_familias rf
             WHERE rf.id_registro = $1`,
            [id_registro]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Registro no encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error detalle registro familia:', error);
        res.status(500).json({ error: 'Error al obtener detalle del registro' });
    }
});

// Lista tareas de un registro de familia
app.get('/api/registros-familia/:id_registro/tareas', async (req, res) => {
    try {
        const id_registro = Number(req.params.id_registro);
        if (!Number.isFinite(id_registro) || id_registro <= 0) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        const result = await pool.query(
            `SELECT
                t.id_tarea,
                t.descripcion_tarea,
                t.fecha_inicio,
                t.fecha_termino,
                te.id_ejecutante,
                e.nombre_ejecutante,
                e.especialidad
             FROM tareas t
             LEFT JOIN tareas_ejecutantes te ON te.id_tarea = t.id_tarea
             LEFT JOIN ejecutantes e ON e.id_ejecutante = te.id_ejecutante
             WHERE t.id_registro_familia = $1
             ORDER BY t.fecha_inicio ASC, t.id_tarea ASC`,
            [id_registro]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error tareas por registro familia:', error);
        res.status(500).json({ error: 'Error al obtener tareas del registro' });
    }
});

// Elimina una tarea individual (y su relación con ejecutantes)
app.delete("/api/tareas/:id_tarea", async (req, res) => {
    const id_tarea = Number(req.params.id_tarea);
    if (!Number.isFinite(id_tarea) || id_tarea <= 0) {
        return res.status(400).json({ error: "ID inválido" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const info = await client.query(
            `SELECT id_tarea, id_registro_familia
             FROM tareas
             WHERE id_tarea = $1`,
            [id_tarea]
        );

        if (info.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Tarea no encontrada" });
        }

        const id_registro = Number(info.rows[0].id_registro_familia);

        await client.query(`DELETE FROM tareas_ejecutantes WHERE id_tarea = $1`, [id_tarea]);
        await client.query(`DELETE FROM tareas WHERE id_tarea = $1`, [id_tarea]);

        await client.query("COMMIT");
        res.json({ success: true, tarea: { id_tarea, id_registro } });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error eliminando tarea:", error);
        res.status(500).json({ error: "Error al eliminar tarea" });
    } finally {
        client.release();
    }
});

// Actualiza un registro de familia y sus tareas (reemplaza tareas existentes)
app.put('/api/registros-familia/:id_registro', async (req, res) => {
    const id_registro = Number(req.params.id_registro);
    const { registro, tareas } = req.body || {};

    if (!Number.isFinite(id_registro) || id_registro <= 0) {
        return res.status(400).json({ error: 'ID inválido' });
    }

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

        const up = await client.query(
            `UPDATE registros_familias
             SET id_familia = $1,
                 id_subfamilia = $2,
                 id_responsable = $3,
                 origen = $4,
                 etiqueta_accion = $5,
                 recinto = $6,
                 comentarios_previos = $7,
                 fecha_levantamiento = $8,
                 fecha_visita = $9,
                 fecha_firma_acta = $10
             WHERE id_registro = $11
               AND id_postventa = $12
             RETURNING id_registro`,
            [
                registro.id_familia,
                registro.id_subfamilia,
                registro.id_responsable,
                registro.origen,
                registro.etiqueta_accion,
                registro.recinto,
                registro.comentarios_previos,
                registro.fecha_levantamiento,
                registro.fecha_visita,
                registro.fecha_firma_acta || null,
                id_registro,
                registro.id_postventa
            ]
        );

        if (up.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado (o no pertenece a la postventa)' });
        }

        // Reemplazar tareas: borrar y reinsertar
        await client.query(
            `DELETE FROM tareas_ejecutantes
             WHERE id_tarea IN (
                SELECT id_tarea FROM tareas WHERE id_registro_familia = $1
             )`,
            [id_registro]
        );

        await client.query(`DELETE FROM tareas WHERE id_registro_familia = $1`, [id_registro]);

        for (const t of tareas) {
            const resTarea = await client.query(
                `INSERT INTO tareas (id_registro_familia, descripcion_tarea, fecha_inicio, fecha_termino)
                 VALUES ($1,$2,$3,$4)
                 RETURNING id_tarea`,
                [id_registro, t.descripcion, t.inicio, t.termino]
            );

            const id_tarea = resTarea.rows[0].id_tarea;
            await client.query(
                `INSERT INTO tareas_ejecutantes (id_tarea, id_ejecutante) VALUES ($1,$2)`,
                [id_tarea, t.id_ejecutante]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, id_registro });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error actualizando registro familia:', error);
        res.status(500).json({ error: 'Error al actualizar registro completo' });
    } finally {
        client.release();
    }
});

app.get('/api/historico/postventas', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                pv.id_postventa,
                p.nombre_proyecto,
                i.numero_identificador
             FROM postventas pv
             JOIN inmuebles i ON i.id_inmueble = pv.id_inmueble
             JOIN proyectos p ON p.id_proyecto = i.id_proyecto
             ORDER BY pv.id_postventa DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error listado postventas historico:', error);
        res.status(500).json({ error: 'Error al listar postventas históricas' });
    }
});

app.get('/api/historico/registros', async (req, res) => {
    try {
        const {
            id_proyecto,
            id_postventa,
            id_familia,
            id_responsable,
            fecha_desde,
            fecha_hasta,
            q,
            identificador,
            cliente,
            subfamilia,
            recinto,
            estado_familia
        } = req.query;

        const where = [];
        const params = [];

        if (id_proyecto) {
            params.push(id_proyecto);
            where.push(`i.id_proyecto = $${params.length}`);
        }

        if (id_postventa) {
            params.push(id_postventa);
            where.push(`pv.id_postventa = $${params.length}`);
        }

        if (id_familia) {
            params.push(id_familia);
            where.push(`rf.id_familia = $${params.length}`);
        }

        if (id_responsable) {
            params.push(id_responsable);
            where.push(`rf.id_responsable = $${params.length}`);
        }

        if (fecha_desde) {
            params.push(fecha_desde);
            where.push(`rf.fecha_levantamiento >= $${params.length}`);
        }

        if (fecha_hasta) {
            params.push(fecha_hasta);
            where.push(`rf.fecha_levantamiento <= $${params.length}`);
        }

        if (q && q.trim()) {
            params.push(`%${q.trim()}%`);
            where.push(`(
                p.nombre_proyecto ILIKE $${params.length}
                OR i.numero_identificador::text ILIKE $${params.length}
                OR c.nombre_completo ILIKE $${params.length}
                OR f.nombre_familia ILIKE $${params.length}
                OR sf.nombre_subfamilia ILIKE $${params.length}
                OR rf.recinto ILIKE $${params.length}
                OR r.nombre_responsable ILIKE $${params.length}
            )`);
        }

        // Filtros por columna (tabla dinámica)
        if (identificador && String(identificador).trim()) {
            params.push(`%${String(identificador).trim()}%`);
            where.push(`i.numero_identificador::text ILIKE $${params.length}`);
        }

        if (cliente && String(cliente).trim()) {
            params.push(`%${String(cliente).trim()}%`);
            where.push(`c.nombre_completo ILIKE $${params.length}`);
        }

        if (subfamilia && String(subfamilia).trim()) {
            params.push(`%${String(subfamilia).trim()}%`);
            where.push(`sf.nombre_subfamilia ILIKE $${params.length}`);
        }

        if (recinto && String(recinto).trim()) {
            params.push(`%${String(recinto).trim()}%`);
            where.push(`rf.recinto ILIKE $${params.length}`);
        }

        const tieneColEstado = await registrosFamiliasTieneEstadoTarea(pool);
        const exprEstado = tieneColEstado
            ? `COALESCE(rf.estado_tarea, 'Pendiente')`
            : `CASE WHEN rf.fecha_firma_acta IS NOT NULL THEN 'Finalizado' ELSE 'Pendiente' END`;

        if (estado_familia && String(estado_familia).trim()) {
            params.push(String(estado_familia).trim());
            where.push(`${exprEstado} = $${params.length}`);
        }

        const clausulaWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const result = await pool.query(
            `SELECT
                rf.id_registro,
                pv.id_postventa,
                p.nombre_proyecto,
                i.numero_identificador,
                c.nombre_completo AS cliente,
                f.nombre_familia AS familia,
                sf.nombre_subfamilia AS subfamilia,
                rf.recinto,
                r.nombre_responsable AS responsable,
                r.cargo AS cargo_responsable,
                rf.origen,
                rf.etiqueta_accion,
                rf.fecha_levantamiento,
                rf.fecha_visita,
                rf.fecha_firma_acta,
                ${exprEstado} AS estado_familia
             FROM registros_familias rf
             JOIN postventas pv ON pv.id_postventa = rf.id_postventa
             JOIN inmuebles i ON i.id_inmueble = pv.id_inmueble
             JOIN proyectos p ON p.id_proyecto = i.id_proyecto
             JOIN clientes c ON c.id_cliente = pv.id_cliente
             LEFT JOIN familias f ON f.id_familia = rf.id_familia
             LEFT JOIN subfamilias sf ON sf.id_subfamilia = rf.id_subfamilia
             LEFT JOIN responsables r ON r.id_responsable = rf.id_responsable
             ${clausulaWhere}
             ORDER BY rf.id_registro DESC`,
            params
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error histórico registros:', error);
        res.status(500).json({ error: 'Error al obtener registros históricos' });
    }
});

// ======================================================
// REGISTROS FAMILIA: ESTADO (PENDIENTE / FINALIZADO)
// ======================================================

function normalizarEstadoRegistro(valor) {
    return (valor === "Finalizado" || valor === "Finalizada") ? "Finalizado" : "Pendiente";
}

async function registrosFamiliasTieneEstadoTarea(client) {
    // Cache simple en memoria para evitar consultar information_schema en cada request.
    if (registrosFamiliasTieneEstadoTarea._cache !== undefined) return registrosFamiliasTieneEstadoTarea._cache;
    const q = await client.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'registros_familias'
           AND column_name = 'estado_tarea'
         LIMIT 1`
    );
    registrosFamiliasTieneEstadoTarea._cache = q.rowCount > 0;
    return registrosFamiliasTieneEstadoTarea._cache;
}

app.put('/api/registros-familia/:id_registro/estado-tarea', async (req, res) => {
    const id_registro = Number(req.params.id_registro);
    const estado_tarea = normalizarEstadoRegistro(req.body?.estado_tarea);

    if (!Number.isFinite(id_registro) || id_registro <= 0) {
        return res.status(400).json({ error: 'ID de registro inválido' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const tieneCol = await registrosFamiliasTieneEstadoTarea(client);
        let row;

        if (tieneCol) {
            const up = await client.query(
                `UPDATE registros_familias
                 SET estado_tarea = $1
                 WHERE id_registro = $2
                 RETURNING id_registro, id_postventa, estado_tarea, fecha_firma_acta`,
                [estado_tarea, id_registro]
            );
            if (up.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Registro no encontrado' });
            }
            row = up.rows[0];
        } else {
            const sel = await client.query(
                `SELECT id_registro, id_postventa, fecha_firma_acta
                 FROM registros_familias
                 WHERE id_registro = $1`,
                [id_registro]
            );
            if (sel.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Registro no encontrado' });
            }
            row = { ...sel.rows[0], estado_tarea };

            // Sin columna de estado, evitamos marcar finalizado si no hay firma acta.
            if (estado_tarea === "Finalizado" && !row.fecha_firma_acta) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Para finalizar, ingrese la Fecha firma acta (cierre).' });
            }
        }

        const id_postventa = Number(row.id_postventa);
        if (!Number.isFinite(id_postventa) || id_postventa <= 0) {
            await client.query('ROLLBACK');
            return res.status(500).json({ error: 'Registro sin postventa asociada' });
        }

        // Recalcula estado de la postventa en base a registros finalizados.
        const condFinal = (await registrosFamiliasTieneEstadoTarea(client))
            ? `COALESCE(rf.estado_tarea, 'Pendiente') = 'Finalizado'`
            : `rf.fecha_firma_acta IS NOT NULL`;

        const counts = await client.query(
            `SELECT
                COUNT(*)::int AS total_familias,
                SUM(CASE WHEN ${condFinal} THEN 1 ELSE 0 END)::int AS finalizadas
             FROM registros_familias rf
             WHERE rf.id_postventa = $1`,
            [id_postventa]
        );

        const total_familias = Number(counts.rows[0]?.total_familias || 0);
        const finalizadas = Number(counts.rows[0]?.finalizadas || 0);
        const nuevo_estado = (total_familias > 0 && finalizadas === total_familias) ? 'Cerrada' : 'Abierta';

        await client.query(
            `UPDATE postventas
             SET estado = $1
             WHERE id_postventa = $2`,
            [nuevo_estado, id_postventa]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            registro: {
                id_registro: Number(row.id_registro),
                estado_tarea
            },
            postventa: {
                id_postventa,
                estado: nuevo_estado,
                total_familias
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error actualizando estado_tarea registro_familias:', error);
        res.status(500).json({ error: 'Error al actualizar el estado del registro' });
    } finally {
        client.release();
    }
});

app.delete('/api/registros-familia/:id_registro', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id_registro } = req.params;
        await client.query('BEGIN');

        await client.query(
            `DELETE FROM tareas_ejecutantes
             WHERE id_tarea IN (
                SELECT id_tarea FROM tareas WHERE id_registro_familia = $1
             )`,
            [id_registro]
        );

        await client.query(
            `DELETE FROM tareas WHERE id_registro_familia = $1`,
            [id_registro]
        );

        const delRegistro = await client.query(
            `DELETE FROM registros_familias
             WHERE id_registro = $1
             RETURNING id_registro, id_postventa`,
            [id_registro]
        );

        if (delRegistro.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        await client.query('COMMIT');
        res.json({ success: true, registro: delRegistro.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error eliminando registro de familia:', error);
        res.status(500).json({ error: 'Error al eliminar registro de familia' });
    } finally {
        client.release();
    }
});

app.delete('/api/postventas/:id_postventa', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id_postventa } = req.params;
        await client.query('BEGIN');

        const postventaRes = await client.query(
            `SELECT id_postventa, id_cliente FROM postventas WHERE id_postventa = $1`,
            [id_postventa]
        );

        if (postventaRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Postventa no encontrada' });
        }

        const id_cliente = postventaRes.rows[0].id_cliente;

        await client.query(
            `DELETE FROM tareas_ejecutantes
             WHERE id_tarea IN (
                SELECT t.id_tarea
                FROM tareas t
                JOIN registros_familias rf ON rf.id_registro = t.id_registro_familia
                WHERE rf.id_postventa = $1
             )`,
            [id_postventa]
        );

        await client.query(
            `DELETE FROM tareas
             WHERE id_registro_familia IN (
                SELECT id_registro
                FROM registros_familias
                WHERE id_postventa = $1
             )`,
            [id_postventa]
        );

        await client.query(
            `DELETE FROM registros_familias WHERE id_postventa = $1`,
            [id_postventa]
        );

        await client.query(
            `DELETE FROM postventas WHERE id_postventa = $1`,
            [id_postventa]
        );

        await client.query(
            `DELETE FROM clientes c
             WHERE c.id_cliente = $1
               AND NOT EXISTS (
                    SELECT 1 FROM postventas pv WHERE pv.id_cliente = c.id_cliente
               )`,
            [id_cliente]
        );

        await client.query('COMMIT');
        res.json({ success: true, id_postventa: Number(id_postventa) });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error eliminando postventa:', error);
        res.status(500).json({ error: 'Error al eliminar postventa' });
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
// CALENDARIO (TAREAS)
// ======================================================

app.get("/api/calendario/tareas", async (req, res) => {
    try {
        const year = Number(req.query.year);
        const month = Number(req.query.month);
        const idEjecutante = req.query.id_ejecutante ? Number(req.query.id_ejecutante) : null;
        const idProyecto = req.query.id_proyecto ? Number(req.query.id_proyecto) : null;

        if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
            return res.status(400).json({ error: "Parámetros inválidos. Use year y month (1-12)." });
        }

        const where = [
            "t.fecha_inicio IS NOT NULL",
            "t.fecha_inicio::date <= r.fin",
            "COALESCE(t.fecha_termino, t.fecha_inicio)::date >= r.inicio"
        ];
        const params = [year, month];

        if (idEjecutante && Number.isFinite(idEjecutante)) {
            params.push(idEjecutante);
            where.push(`te.id_ejecutante = $${params.length}`);
        }

        if (idProyecto && Number.isFinite(idProyecto)) {
            params.push(idProyecto);
            where.push(`p.id_proyecto = $${params.length}`);
        }

        const query = `
            WITH r AS (
                SELECT
                    make_date($1::int, $2::int, 1) AS inicio,
                    (make_date($1::int, $2::int, 1) + interval '1 month' - interval '1 day')::date AS fin
            )
            SELECT
                t.id_tarea,
                t.descripcion_tarea,
                t.fecha_inicio,
                t.fecha_termino,
                te.id_ejecutante,
                e.nombre_ejecutante,
                e.especialidad,
                p.id_proyecto,
                p.nombre_proyecto,
                i.numero_identificador,
                f.nombre_familia,
                sf.nombre_subfamilia,
                rf.recinto,
                rf.id_registro AS id_registro_familia,
                pv.id_postventa
            FROM tareas t
            JOIN registros_familias rf ON rf.id_registro = t.id_registro_familia
            JOIN postventas pv ON pv.id_postventa = rf.id_postventa
            JOIN inmuebles i ON i.id_inmueble = pv.id_inmueble
            JOIN proyectos p ON p.id_proyecto = i.id_proyecto
            LEFT JOIN familias f ON f.id_familia = rf.id_familia
            LEFT JOIN subfamilias sf ON sf.id_subfamilia = rf.id_subfamilia
            LEFT JOIN tareas_ejecutantes te ON te.id_tarea = t.id_tarea
            LEFT JOIN ejecutantes e ON e.id_ejecutante = te.id_ejecutante
            CROSS JOIN r
            WHERE ${where.join(" AND ")}
            ORDER BY t.fecha_inicio ASC, t.id_tarea ASC
        `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error calendario tareas:", error);
        res.status(500).json({ error: "Error al obtener tareas del calendario" });
    }
});

// ======================================================
// SERVIDOR
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`ðŸš€ Servidor corriendo en http://localhost:${PORT}`);
});

