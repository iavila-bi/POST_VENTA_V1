const jwt = require("jsonwebtoken");
const pool = require("../db");

function estadoEsActivo(valor) {
    if (valor === null || valor === undefined || valor === "") return true;
    const v = String(valor).toLowerCase().trim();
    if (["inactivo", "inactive", "0", "false", "f", "no"].includes(v)) return false;
    return true;
}

/**
 * Middleware de autenticación por JWT.
 * - Espera header: Authorization: Bearer <token>
 * - Decodifica token
 * - Obtiene usuario + rol desde BD
 * - Inyecta req.user
 */
async function authMiddleware(req, res, next) {
    try {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: "No autenticado (token faltante)" });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            // Misconfig del servidor
            return res.status(500).json({ error: "JWT_SECRET no está configurado en el servidor" });
        }

        const payload = jwt.verify(token, secret);
        const id_usuario = Number(payload?.id_usuario);

        if (!Number.isFinite(id_usuario) || id_usuario <= 0) {
            return res.status(401).json({ error: "Token inválido (payload)" });
        }

        const result = await pool.query(
            `SELECT
                u.id_usuario,
                u.username,
                u.email,
                u.estado,
                u.id_rol,
                r.nombre_rol
             FROM usuarios u
             JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.id_usuario = $1`,
            [id_usuario]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Usuario no existe" });
        }

        const u = result.rows[0];
        if (!estadoEsActivo(u.estado)) {
            return res.status(403).json({ error: "Usuario inactivo" });
        }

        req.user = {
            id_usuario: Number(u.id_usuario),
            username: u.username,
            email: u.email,
            id_rol: Number(u.id_rol),
            rol: u.nombre_rol
        };

        return next();
    } catch (err) {
        return res.status(401).json({ error: "No autenticado (token inválido)" });
    }
}

module.exports = authMiddleware;
