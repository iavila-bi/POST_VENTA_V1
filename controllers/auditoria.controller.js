const pool = require("../db");

// GET /api/auditoria
async function listarAuditoria(req, res) {
    try {
        const result = await pool.query(
            `SELECT
                u.username,
                r.nombre_rol AS rol,
                a.accion,
                a.tabla_afectada,
                a.descripcion,
                a.fecha_accion AS fecha
             FROM auditoria a
             JOIN usuarios u ON u.id_usuario = a.id_usuario
             JOIN roles r ON r.id_rol = u.id_rol
             ORDER BY a.fecha_accion DESC
             LIMIT 500`
        );
        return res.json(result.rows);
    } catch (err) {
        return res.status(500).json({ error: "Error al obtener auditoría" });
    }
}

module.exports = {
    listarAuditoria
};

