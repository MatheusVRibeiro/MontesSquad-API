const express = require('express');
const router = express.Router();

const habilidadesUsuarioController = require('../controllers/habilidades_usuario');
const habilidadesProjetoController = require('../controllers/habilidades_projeto');

// ROTAS HABILIDADES USUÁRIO
router.get('/habilidades-usuario', habilidadesUsuarioController.listarHabilidadesUsuario);
router.post('/habilidades-usuario', habilidadesUsuarioController.cadastrarHabilidadesUsuario);
router.patch('/habilidades-usuario/:id', habilidadesUsuarioController.editarHabilidadesUsuario);
router.delete('/habilidades-usuario/:id', habilidadesUsuarioController.apagarHabilidadesUsuario);

// ROTAS HABILIDADES PROJETO
router.get('/habilidades-projeto', habilidadesProjetoController.listarHabilidadesProjeto);
router.post('/habilidades-projeto', habilidadesProjetoController.cadastrarHabilidadesProjeto);
router.patch('/habilidades-projeto/:id', habilidadesProjetoController.editarHabilidadesProjeto);
router.delete('/habilidades-projeto/:id', habilidadesProjetoController.apagarHabilidadesProjeto);

module.exports = router;