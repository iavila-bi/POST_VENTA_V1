const express = require("express");
const auth = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/role.middleware");
const {
    crearUsuario,
    listarUsuarios,
    eliminarUsuario
} = require("../controllers/usuarios.controller");

const router = express.Router();

// Admin only
router.get("/", auth, requireAdmin, listarUsuarios);
router.post("/", auth, requireAdmin, crearUsuario);
router.delete("/:id", auth, requireAdmin, eliminarUsuario);

module.exports = router;

