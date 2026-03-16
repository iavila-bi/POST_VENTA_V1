const bcrypt = require("bcryptjs");
const pool = require("../db");
const { registrarAuditoria } = require("../services/auditoria.service");

let _usuariosEstadoIsBoolean; // cache simple para soportar estado boolean/text
async function usuariosEstadoIsBoolean() {
    if (_usuariosEstadoIsBoolean !== undefined) return _usuariosEstadoIsBoolean;
    const q = await pool.query(
        `SELECT data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'usuarios'
           AND column_name = 'estado'
         LIMIT 1`
    );
    _usuariosEstadoIsBoolean = String(q.rows[0]?.data_type || "").toLowerCase() === "boolean";
    return _usuariosEstadoIsBoolean;
}

function normalizarRolInput(body) {
    const id_rol = body?.id_rol ? Number(body.id_rol) : null;
    const rol = body?.rol ? String(body.rol).trim() : null;
    return { id_rol, rol };
}

async function resolverIdRol({ id_rol, rol }) {
    if (Number.isFinite(id_rol) && id_rol > 0) {
        const q = await pool.query(`SELECT id_rol FROM roles WHERE id_rol = $1`, [id_rol]);
        if (q.rowCount === 0) throw new Error("Rol inválido");
        return id_rol;
    }

    if (rol) {
        const q = await pool.query(`SELECT id_rol FROM roles WHERE LOWER(nombre_rol) = LOWER($1)`, [rol]);
        if (q.rowCount === 0) throw new Error("Rol inválido");
        return Number(q.rows[0].id_rol);
    }

    throw new Error("Rol requerido");
}

// POST /api/usuarios
async function crearUsuario(req, res) {
    try {
        const { username, nombre, apellido, email, password } = req.body || {};
        const { id_rol, rol } = normalizarRolInput(req.body);

        if (!username || !nombre || !apellido || !email || !password) {
            return res.status(400).json({ error: "Faltan campos obligatorios" });
        }

        const idRolFinal = await resolverIdRol({ id_rol, rol });
        const password_hash = await bcrypt.hash(String(password), 12);

        const estadoBool = await usuariosEstadoIsBoolean();
        const estadoValor = estadoBool ? true : "activo";

        const insert = await pool.query(
            `INSERT INTO usuarios (username, nombre, apellido, email, password_hash, id_rol, estado, fecha_creacion)
             VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
             RETURNING id_usuario, username, nombre, apellido, email, id_rol, estado`,
            [username, nombre, apellido, email, password_hash, idRolFinal, estadoValor]
        );

        const nuevo = insert.rows[0];

        await registrarAuditoria({
            id_usuario: req.user.id_usuario,
            accion: "CREAR_USUARIO",
            tabla: "usuarios",
            id_registro: Number(nuevo.id_usuario),
            descripcion: `Creó usuario ${nuevo.username} (${nuevo.email})`
        });

        return res.status(201).json({
            id_usuario: Number(nuevo.id_usuario),
            username: nuevo.username,
            nombre: nuevo.nombre,
            apellido: nuevo.apellido,
            email: nuevo.email,
            id_rol: Number(nuevo.id_rol),
            estado: estadoBool ? (nuevo.estado ? "activo" : "inactivo") : nuevo.estado
        });
    } catch (err) {
        // 23505 = unique_violation
        if (err?.code === "23505") {
            return res.status(409).json({ error: "Username o email ya existe" });
        }
        return res.status(500).json({ error: err.message || "Error al crear usuario" });
    }
}

// GET /api/usuarios
async function listarUsuarios(req, res) {
    try {
        const estadoBool = await usuariosEstadoIsBoolean();
        const estadoSelect = estadoBool
            ? `CASE WHEN u.estado IS FALSE THEN 'inactivo' ELSE 'activo' END AS estado`
            : `u.estado`;
        const result = await pool.query(
            `SELECT
                u.id_usuario AS id,
                u.username,
                u.nombre,
                u.apellido,
                u.email,
                r.nombre_rol AS rol,
                ${estadoSelect}
             FROM usuarios u
             JOIN roles r ON r.id_rol = u.id_rol
             ORDER BY u.id_usuario DESC`
        );
        return res.json(result.rows);
    } catch (err) {
        return res.status(500).json({ error: "Error al listar usuarios" });
    }
}

// DELETE /api/usuarios/:id
async function eliminarUsuario(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ error: "ID inválido" });
        }

        if (id === req.user.id_usuario) {
            return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
        }

        // Soft delete para no romper auditoría/foreign keys.
        // Si tu instalación permite hard delete, cambia a:
        // DELETE FROM usuarios WHERE id_usuario = $1 RETURNING ...
        const estadoBool = await usuariosEstadoIsBoolean();
        const estadoValor = estadoBool ? false : "inactivo";

        const up = await pool.query(
            `UPDATE usuarios
             SET estado = $1
             WHERE id_usuario = $2
             RETURNING id_usuario, username, email`,
            [estadoValor, id]
        );

        if (up.rowCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const u = up.rows[0];

        await registrarAuditoria({
            id_usuario: req.user.id_usuario,
            accion: "ELIMINAR_USUARIO",
            tabla: "usuarios",
            id_registro: Number(u.id_usuario),
            descripcion: `Marcó como inactivo a ${u.username} (${u.email})`
        });

        return res.json({ success: true, id_usuario: Number(u.id_usuario) });
    } catch (err) {
        return res.status(500).json({ error: "Error al eliminar usuario" });
    }
}

module.exports = {
    crearUsuario,
    listarUsuarios,
    eliminarUsuario
};
