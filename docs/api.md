# Documentação de Rotas e Contratos da API - MontesSquad

Este documento descreve o formato padrão de respostas da API e fornece detalhes sobre os principais endpoints do MontesSquad.

## Contrato de Resposta Padronizado

Todas as respostas HTTP retornadas pela API seguem a mesma estrutura JSON.

### Resposta de Sucesso (HTTP 200, 201)
```json
{
  "sucesso": true,
  "message": "Mensagem descritiva da ação realizada com sucesso.",
  "dados": {
    "campo1": "valor1",
    "campo2": "valor2"
  }
}
```
*Observação: Quando aplicável, por exemplo na listagem de itens, pode conter também o campo `nItens` no mesmo nível.*

### Resposta de Erro (HTTP 400, 401, 403, 404, 500)
```json
{
  "sucesso": false,
  "message": "Mensagem detalhando o erro amigável ao usuário.",
  "dados": null
}
```
*Observação: Em ambiente de desenvolvimento (`NODE_ENV=development`), o campo `dados` conterá a mensagem técnica ou o stack trace do erro (`error.message`). Em produção (`NODE_ENV=production`), ele será sempre `null` para evitar vazamentos de informações internas de banco de dados.*

---

## Principais Endpoints

### 1. Autenticação (Pública)

#### `POST /login`
Efetua o login de um usuário cadastrado e retorna o token de autenticação.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "senha": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Login realizado com sucesso",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "dados": {
      "id": 1,
      "nome": "João Silva",
      "email": "user@example.com",
      "tipo": "membro"
    }
  }
  ```

#### `POST /recuperar-senha`
Solicita link de recuperação de senha por e-mail.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```

---

### 2. Usuários

#### `POST /usuarios` (Pública)
Cadastra um novo usuário na plataforma.
- **Request Body:**
  ```json
  {
    "nome": "João Silva",
    "email": "user@example.com",
    "senha": "password123",
    "bio": "Desenvolvedor Backend Node.js",
    "localizacao": "Belo Horizonte, MG"
  }
  ```

#### `PATCH /usuarios/:id` (Requer Token)
Atualiza os dados cadastrais do perfil do próprio usuário.
- **Request Body:**
  ```json
  {
    "bio": "Desenvolvedor Backend Pleno"
  }
  ```

---

### 3. Projetos (Squads)

#### `POST /projetos` (Requer Token)
Cria um novo projeto. O usuário autenticado torna-se automaticamente o dono (Owner).
- **Request Body:**
  ```json
  {
    "name": "MonteSquad Web",
    "description": "Plataforma para formação de squads e projetos colaborativos.",
    "membersLimit": 6,
    "repositorioUrl": "https://github.com/exemplo",
    "figmaUrl": "https://figma.com/exemplo"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Cadastro de projeto realizado com sucesso",
    "dados": {
      "id": 10,
      "criador_id": 1,
      "titulo": "MonteSquad Web",
      "descricao": "Plataforma para formação de squads e projetos colaborativos.",
      "status": "aberto",
      "limite_membros": 6,
      "repositorio_url": "https://github.com/exemplo",
      "figma_url": "https://figma.com/exemplo",
      "discord_url": null,
      "documentacao_url": null
    }
  }
  ```

#### `GET /projetos/:id` (Requer Token)
Obtém o detalhamento completo de um projeto específico, incluindo seus membros da equipe, tarefas do Kanban, mensagens do mural e candidaturas (caso o usuário logado seja o dono).
- **Response (200 OK):**
  ```json
  {
    "sucesso": true,
    "message": "Detalhes do projeto carregados com sucesso",
    "dados": {
      "id": "10",
      "name": "MonteSquad Web",
      "description": "Plataforma para...",
      "status": "Aberto",
      "membersLimit": 6,
      "members": [
        { "id": "1", "name": "João Silva", "role": "Owner", "skills": [] }
      ],
      "tasks": [],
      "messages": [],
      "applications": []
    }
  }
  ```

---

### 4. Mural de Mensagens

#### `POST /projetos/:projetoId/mensagens` (Requer ser Membro ou Dono)
Envia uma mensagem no mural de discussões do squad.
- **Request Body:**
  ```json
  {
    "content": "Olá a todos do squad! Vamos agendar nossa primeira reunião."
  }
  ```

---

### 5. Candidaturas (Match)

#### `POST /projetos/:projetoId/candidaturas` (Requer Token)
Um membro candidata-se para participar de um squad de projeto.
- **Request Body:**
  ```json
  {
    "mensagem": "Possuo experiência com React e gostaria de apoiar no frontend!"
  }
  ```

---

### 6. Kanban & Tarefas

#### `POST /projetos/:projetoId/tarefas` (Requer ser Membro ou Dono do Projeto)
Cria e atribui uma tarefa a um membro do squad. Desde a FASE-03 (3.G), membros do squad podem criar tarefas (não apenas o dono).
- **Request Body:**
  ```json
  {
    "titulo": "Modelagem SQL",
    "descricao": "Escrever os scripts DDL iniciais",
    "prioridade": "high",
    "responsavel_id": 2
  }
  ```
- **Nota:** quando `responsavel_id` está presente, o sistema dispara uma notificação do tipo `task` para o responsável.

---

### 7. Notificações

#### `GET /notificacoes` (Requer Token)
Lista as notificações do usuário autenticado, mais recentes primeiro.
- **Contrato (camelCase):** o campo `dados` é um array de `{ id, type, title, description, createdAt, read, link }`.
- `type` é um ENUM: `application` (nova candidatura p/ o dono), `approved` (candidatura aprovada), `message` (nova mensagem no mural), `task` (tarefa atribuída), `system`.

#### `POST /notificacoes/ler-tudo` (Requer Token)
Marca todas as notificações do usuário como lidas (`read = true`).

---

### 8. Reputação

#### `GET /usuarios/:userId/reputacao` (Requer Token; alias `me` para o próprio usuário)
Retorna o resumo de reputação do usuário: XP, nível, avaliações, histórico de projetos e conquistas.
- **Contrato:** `dados` com `{ level, xp, xpProximo, reputacao, projetosConcluidos, conquistas, historico, avaliacoes }` (campos aninhados em camelCase — conferir com `references/fase02-controllers-contrato.md`).

---

### 9. Habilidades

#### `GET /habilidades` (Requer Token)
Lista a base global de habilidades disponíveis.

#### `POST /habilidades-usuario` (Requer Token)
Vincula uma habilidade ao usuário autenticado.
- **Request Body:** `{ habilidade_id }` (ou `{ habilidadeId }` conforme contrato — conferir controller).

#### `POST /habilidades-projeto` (Requer Token)
Vincula uma habilidade (tecnologia) a um projeto.
- **Request Body:** `{ projeto_id, habilidade_id }`.

---

### 10. Healthcheck

#### `GET /health` (Público)
Verifica a conectividade com o banco de dados sem derrubar o boot.
- **Resposta:** `{ sucesso: true, banco: "ok" | "erro" }` — HTTP 200 mesmo com banco indisponível (banco `"erro"`).
