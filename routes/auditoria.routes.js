const express = require("express");
const auth = require("../middlewares/auth.middleware");
const { requireAdmin } = require("../middlewares/role.middleware");
const { listarAuditoria } = require("../controllers/auditoria.controller");

const router = express.Router();

// Admin only
router.get("/", auth, requireAdmin, listarAuditoria);

module.exports = router;

