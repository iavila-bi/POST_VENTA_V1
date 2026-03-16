/**
 * Middleware de autorización por rol.
 * Requiere que auth.middleware haya cargado req.user.
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: "No autenticado" });
    }
    if (String(req.user.rol).toLowerCase() !== "admin") {
        return res.status(403).json({ error: "Acceso denegado: requiere rol admin" });
    }
    return next();
}

module.exports = {
    requireAdmin
};

