const express = require('express');
const router = express.Router();

const usuariosController = require('../controllers/usuarios');
const projetosController = require('../controllers/projetos');
const habilidadesController = require('../controllers/habilidades');
const habilidadesUsuarioController = require('../controllers/habilidades_usuario');
const habilidadesProjetoController = require('../controllers/habilidades_projeto');

// ROTAS USUÁRIOS
router.get('/usuarios', usuariosController.listarUsuarios);
router.post('/usuarios', usuariosController.cadastrarUsuario);
router.patch('/usuarios/:id', usuariosController.editarUsuario);
router.delete('/usuarios/:id', usuariosController.apagarUsuario);

// ROTAS PROJETOS
router.get('/projetos', projetosController.listarProjetos);
router.post('/projetos', projetosController.cadastrarProjeto);
router.patch('/projetos/:id', projetosController.editarProjeto);
router.delete('/projetos/:id', projetosController.apagarProjeto);

// ROTAS HABILIDADES
router.get('/habilidades', habilidadesController.listarHabilidades);
router.post('/habilidades', habilidadesController.cadastrarHabilidade);
router.patch('/habilidades/:id', habilidadesController.editarHabilidade);
router.delete('/habilidades/:id', habilidadesController.apagarHabilidade);

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