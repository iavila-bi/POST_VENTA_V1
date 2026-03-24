const pool = require("../db");

/**
 * Inserta un registro en la tabla auditoria.
 * Se diseña como función reutilizable para todo el sistema.
 *
 * @param {Object} params
 * @param {number} params.id_usuario - ID del usuario que ejecuta la acción
 * @param {string} params.accion - Acción (ej: "CREAR_USUARIO", "ELIMINAR_USUARIO")
 * @param {string} params.tabla - Tabla afectada (ej: "usuarios")
 * @param {number|null} [params.id_registro] - ID del registro afectado (ej: id_usuario creado/eliminado)
 * @param {string} [params.descripcion] - Texto descriptivo
 */
async function registrarAuditoria(
    { id_usuario, accion, tabla, id_registro = null, descripcion = "" },
    executor = pool
) {
    if (!id_usuario || !accion || !tabla) {
        throw new Error("registrarAuditoria: faltan campos obligatorios (id_usuario, accion, tabla)");
    }

    await executor.query(
        `INSERT INTO auditoria (id_usuario, accion, tabla_afectada, id_registro, descripcion, fecha_accion)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id_usuario, accion, tabla, id_registro, descripcion]
    );
}

module.exports = {
    registrarAuditoria
};
