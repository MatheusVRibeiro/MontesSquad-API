// Agregador central de rotas modularizadas da MontesSquad API
const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const usuariosRoutes = require("./usuarios.routes");
const projetosRoutes = require("./projetos.routes");
const tarefasRoutes = require("./tarefas.routes");
const matchingRoutes = require("./matching.routes");
const githubRoutes = require("./github.routes");

router.use(authRoutes);
router.use(usuariosRoutes);
router.use(projetosRoutes);
router.use(tarefasRoutes);
router.use(matchingRoutes);
router.use(githubRoutes);

module.exports = router;