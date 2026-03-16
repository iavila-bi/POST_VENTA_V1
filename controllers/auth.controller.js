const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

function estadoEsActivo(valor) {
    // Compatibilidad: la columna `estado` puede ser texto/boolean/número o incluso NULL si se insertó manualmente.
    // Política: NULL/"" se considera activo; bloqueamos solo valores explícitos de inactividad.
    if (valor === null || valor === undefined || valor === "") return true;
    const v = String(valor).toLowerCase().trim();
    if (["inactivo", "inactive", "0", "false", "f", "no"].includes(v)) return false;
    return true;
}

// POST /api/auth/login
// Body: { user: "username o email", password: "..." }
async function login(req, res) {
    try {
        const { user, password } = req.body || {};
        const u = String(user || "").trim();
        const p = String(password || "");

        if (!u || !p) {
            return res.status(400).json({ error: "User y password son obligatorios" });
        }

        const q = await pool.query(
            `SELECT
                u.id_usuario,
                u.username,
                u.email,
                u.password_hash,
                u.estado,
                r.nombre_rol AS rol
             FROM usuarios u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)
             LIMIT 1`,
            [u]
        );

        if (q.rowCount === 0) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const row = q.rows[0];
        if (!estadoEsActivo(row.estado)) {
            return res.status(403).json({ error: "Usuario inactivo" });
        }

        const ok = await bcrypt.compare(p, row.password_hash);
        if (!ok) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ error: "JWT_SECRET no está configurado en el servidor" });
        }

        const token = jwt.sign(
            { id_usuario: Number(row.id_usuario) },
            secret,
            { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
        );

        return res.json({
            token,
            user: {
                id_usuario: Number(row.id_usuario),
                username: row.username,
                email: row.email,
                rol: row.rol
            }
        });
    } catch (err) {
        console.error("Auth login error:", err);
        return res.status(500).json({ error: "Error en login" });
    }
}

module.exports = {
    login
};
