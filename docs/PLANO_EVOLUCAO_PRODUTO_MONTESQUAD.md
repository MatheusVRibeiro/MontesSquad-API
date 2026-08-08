# MontesSquad — Plano detalhado de evolução do produto

> Documento complementar ao `IMPLEMENTACAO_GITHUB_KANBAN.md`.
> Este arquivo descreve as evoluções de produto e arquitetura que devem ser implementadas de forma sequencial, com objetivos, arquivos a criar/alterar, regras de negócio, endpoints, banco, testes e gates obrigatórios.

---

# 1. Objetivo geral

Evoluir o MontesSquad de um Kanban colaborativo para uma plataforma completa de formação de squads, contribuição técnica verificável e construção de reputação profissional.

A plataforma deverá permitir:

- cadastro/login com GitHub ou e-mail/senha;
- conexão posterior da conta GitHub dentro do sistema;
- perfil técnico estruturado;
- criação de projetos com papéis/vagas necessárias;
- candidaturas direcionadas por função;
- tasks com habilidades e dificuldade;
- tasks assumíveis;
- abandono, remoção e reatribuição de tarefas;
- histórico de participação preservado;
- portfólio verificável;
- separação entre XP e reputação técnica;
- rankings por contribuição;
- privacidade para repositórios privados;
- matching Projeto ↔ Desenvolvedor ↔ Task.

Princípio de produto:

> O MontesSquad deve conectar pessoas a projetos reais, organizar a contribuição e transformar entregas verificáveis em reputação profissional.

---

# 2. REGRA ABSOLUTA DE EXECUÇÃO

## 2.1 Uma etapa por vez

Não iniciar a implementação da próxima etapa enquanto a etapa atual não estiver 100% concluída.

Uma etapa só é considerada concluída quando:

1. todos os arquivos previstos foram criados/alterados;
2. banco/migration daquela etapa foi validado;
3. endpoints necessários estão implementados;
4. frontend da etapa está integrado quando aplicável;
5. testes automatizados relacionados passam;
6. lint passa quando aplicável;
7. regressões foram verificadas;
8. regras de segurança/autorização foram revisadas;
9. critérios de aceite foram comprovados;
10. não existe pendência bloqueante.

## 2.2 Gate obrigatório

Ao final de cada etapa:

```text
ETAPA X — GATE DE CONCLUSÃO

[ ] backend concluído
[ ] frontend concluído
[ ] migration validada
[ ] endpoints testados
[ ] testes passando
[ ] lint passando
[ ] regressões verificadas
[ ] segurança revisada
[ ] critérios de aceite comprovados
[ ] nenhuma pendência bloqueante
```

Somente após todos os itens aplicáveis estarem concluídos pode avançar.

## 2.3 Subagentes

É permitido dividir a etapa atual entre subagentes independentes.

Enquanto aguarda subagentes:

- pode analisar a próxima etapa;
- pode ler arquivos;
- pode planejar distribuição;
- pode mapear riscos e dependências;
- pode preparar checklist;

Mas NÃO pode:

- alterar arquivos da próxima etapa;
- executar migrations da próxima etapa;
- commitar mudanças da próxima etapa;
- misturar implementações de etapas diferentes.

---

# 3. ETAPA 0 — Baseline e inventário técnico

## Objetivo

Garantir que a evolução parta do estado real dos dois repositórios e que nenhuma mudança futura quebre fluxos já existentes.

## Arquivos a revisar no backend

```text
src/controllers/autenticacao.js
src/controllers/usuarios.js
src/controllers/projetos.js
src/controllers/candidaturas.js
src/controllers/membros.js
src/controllers/tarefas.js
src/controllers/reputacao.js
src/controllers/notificacoes.js
src/routes/routes.js
src/middlewares/auth.js
src/database/createDatabase/Tabelas.sql
src/database/createDatabase/Insert.sql
.env.example
package.json
```

## Arquivos a revisar no frontend

```text
src/contexts/AuthContext.tsx
src/services/api.ts
src/services/projectDetail.ts
src/services/projects.ts
src/services/perfil.ts
src/services/reputation.ts
src/components/projects/ProjectCard.tsx
src/components/projects/Applications.tsx
src/components/projects/MembersList.tsx
src/components/projects/KanbanBoard.tsx
src/components/profile/*
```

## O que fazer

1. mapear contratos reais de autenticação;
2. mapear shape de `usuarios`;
3. mapear criação de projeto;
4. mapear candidatura e aprovação;
5. mapear membros;
6. mapear task e responsável;
7. mapear reputação e XP;
8. registrar endpoints já existentes;
9. rodar testes atuais;
10. registrar baseline.

## Critério de aceite

Nenhuma alteração de produto é iniciada antes de o comportamento atual estar mapeado e os testes atuais conhecidos.

---

# 4. ETAPA 1 — Cadastro/login com GitHub OAuth

## Objetivo

Permitir que o usuário crie conta ou faça login usando GitHub, sem tornar GitHub obrigatório.

Fluxos suportados:

```text
A) Continuar com GitHub
B) Cadastro normal por e-mail/senha
C) Conta existente conecta GitHub posteriormente
```

## Banco — alterações em `usuarios`

Adicionar de forma idempotente:

```sql
ALTER TABLE usuarios
ADD COLUMN github_user_id BIGINT NULL,
ADD COLUMN github_login VARCHAR(100) NULL,
ADD COLUMN github_avatar_url VARCHAR(500) NULL,
ADD COLUMN github_connected_at DATETIME NULL,
ADD COLUMN cadastro_origem ENUM('local','github') DEFAULT 'local' NOT NULL,
ADD UNIQUE INDEX uq_usuarios_github_user_id (github_user_id);
```

## Backend — arquivos a criar

```text
src/services/githubOAuth.js
```

Funções esperadas:

```js
buildGitHubAuthorizationUrl(state)
exchangeCodeForAccessToken(code)
fetchGitHubUser(accessToken)
fetchGitHubPrimaryEmail(accessToken)
```

## Backend — arquivos a alterar

```text
src/controllers/autenticacao.js
src/controllers/usuarios.js
src/routes/routes.js
.env.example
package.json
```

## Endpoints a criar

```text
GET /auth/github
GET /auth/github/callback
POST /auth/github/complete-profile
```

## Regras de negócio

### Primeiro acesso via GitHub

1. GitHub retorna `id`, `login`, `avatar_url`, `name`, e-mail quando permitido;
2. buscar `usuarios.github_user_id`;
3. se encontrado → login;
4. se não encontrado → verificar possibilidade de conta existente por e-mail;
5. se não houver conta correspondente → criar registro parcial;
6. redirecionar para completar perfil.

### Conta existente com mesmo e-mail

Não vincular automaticamente sem validação adequada.

Fluxo recomendado:

```text
Encontramos uma conta MontesSquad com este e-mail.
Entre na conta existente para confirmar o vínculo com GitHub.
```

Depois do login local, permitir vinculação.

### Segurança

- usar `state` anti-CSRF;
- nunca expor client secret no frontend;
- access token GitHub fica somente no backend;
- não persistir token se não for necessário depois;
- se persistir futuramente, criptografar em repouso.

## Frontend — arquivos a alterar

```text
página de login
página de cadastro
AuthContext.tsx
```

Adicionar botão:

```text
[ Continuar com GitHub ]
```

## Frontend — arquivos a criar

```text
src/pages/CompleteProfile.tsx
```

(adaptar ao padrão real do router.)

## Testes

- GitHub user existente → login;
- GitHub user novo → onboarding;
- callback sem state válido → rejeita;
- usuário local com mesmo e-mail → não duplica silenciosamente;
- falha do GitHub → erro tratável;
- login local continua funcionando.

## Gate

Só avançar quando login GitHub e login local coexistirem sem regressão.

---

# 5. ETAPA 2 — Conectar/desconectar GitHub dentro do sistema

## Objetivo

Permitir que quem criou conta normalmente conecte GitHub posteriormente e que quem entrou com GitHub visualize o vínculo existente.

## Backend — endpoints

```text
GET    /github/me
GET    /github/connect
GET    /github/callback-link
DELETE /github/disconnect
```

## Regras

### Conectar

- usuário precisa estar autenticado no MontesSquad;
- OAuth deve associar GitHub à conta atual;
- impedir GitHub ID já vinculado a outra conta;
- atualizar login/avatar;
- registrar `github_connected_at`.

### Desconectar

Se conta foi criada via GitHub e não possuir senha local:

- não permitir desconectar imediatamente;
- exigir criação de senha local primeiro.

Evitar conta sem método de login.

## Backend — arquivos a criar/alterar

Criar:

```text
src/controllers/githubConta.js
```

Alterar:

```text
src/services/githubOAuth.js
src/routes/routes.js
src/controllers/usuarios.js
```

## Frontend

Criar seção:

```text
Configurações > Integrações
```

Componente sugerido:

```text
src/components/settings/GitHubConnectionCard.tsx
```

Estados:

```text
Não conectado
Conectando
Conectado
Erro
```

## Critério de aceite

Usuário local conecta GitHub e usuário GitHub consegue desconectar somente se mantiver outro método de autenticação.

---

# 6. ETAPA 3 — Completar perfil técnico

## Objetivo

Transformar conta básica em perfil útil para matching e colaboração.

## Dados recomendados

```text
nome
bio
localização
tecnologias
nível por tecnologia
funções de interesse
disponibilidade semanal
objetivo atual
```

Exemplo de funções:

```text
Backend
Frontend
Full Stack
Mobile
QA
DevOps
UX/UI
Data
Product
```

## Banco — tabelas novas

### `funcoes`

```sql
CREATE TABLE funcoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE
);
```

### `funcoes_usuario`

```sql
CREATE TABLE funcoes_usuario (
    usuario_id INT NOT NULL,
    funcao_id INT NOT NULL,
    nivel_interesse ENUM('baixo','medio','alto') DEFAULT 'medio',
    PRIMARY KEY (usuario_id, funcao_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE CASCADE
);
```

Adicionar em `usuarios`:

```sql
ALTER TABLE usuarios
ADD COLUMN disponibilidade_horas_semana INT NULL,
ADD COLUMN objetivo_profissional VARCHAR(255) NULL,
ADD COLUMN perfil_completo BOOLEAN DEFAULT FALSE;
```

## Backend

Criar/alterar endpoints:

```text
GET   /funcoes
GET   /usuarios/me/perfil
PATCH /usuarios/me/perfil
PUT   /usuarios/me/funcoes
PUT   /usuarios/me/habilidades
```

## Frontend

Criar onboarding em etapas:

```text
1. Perfil básico
2. Tecnologias
3. Funções de interesse
4. Disponibilidade
5. Objetivo
```

## Regra importante

GitHub pode sugerir tecnologias futuramente, mas não definir nível automaticamente.

## Critério de aceite

Perfil completo precisa poder alimentar filtros e matching sem depender do GitHub.

---

# 7. ETAPA 4 — Papéis/vagas necessárias no projeto

## Objetivo

Trocar a ideia limitada de “quantidade de pessoas” por vagas estruturadas por função.

Projeto pode continuar com `limite_membros`, mas ganhar vagas.

Exemplo:

```text
2 Backend
1 Frontend
1 QA
1 UX/UI
```

## Banco — tabela nova `vagas_projeto`

```sql
CREATE TABLE vagas_projeto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    projeto_id INT NOT NULL,
    funcao_id INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    preenchidas INT NOT NULL DEFAULT 0,
    descricao TEXT NULL,
    nivel_desejado ENUM('iniciante','intermediario','avancado','qualquer') DEFAULT 'qualquer',
    status ENUM('aberta','fechada') DEFAULT 'aberta',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE RESTRICT
);
```

## Backend

Criar controller:

```text
src/controllers/vagasProjeto.js
```

Endpoints:

```text
GET    /projetos/:projetoId/vagas
POST   /projetos/:projetoId/vagas
PATCH  /projetos/:projetoId/vagas/:vagaId
DELETE /projetos/:projetoId/vagas/:vagaId
```

Somente owner altera vagas.

## Frontend

Na criação do projeto:

```text
Quais perfis você procura?

Backend      2
Frontend     1
QA           1
```

Adicionar editor posterior no projeto.

## Regras

- quantidade > 0;
- `preenchidas <= quantidade`;
- preencher automaticamente ao aceitar candidatura vinculada à vaga;
- reabrir vaga se membro sair, quando aplicável.

## Critério de aceite

Projeto passa a comunicar claramente quais perfis ainda procura.

---

# 8. ETAPA 5 — Candidatura direcionada por vaga/função

## Objetivo

Permitir que o usuário se candidate para uma função específica.

## Banco

Alterar `candidaturas`:

```sql
ALTER TABLE candidaturas
ADD COLUMN vaga_id INT NULL,
ADD CONSTRAINT fk_candidaturas_vaga
FOREIGN KEY (vaga_id) REFERENCES vagas_projeto(id) ON DELETE SET NULL;
```

## Backend — alterar

```text
src/controllers/candidaturas.js
```

POST deverá aceitar:

```json
{
  "vaga_id": 12,
  "mensagem": "Quero contribuir no backend"
}
```

## Validações

- vaga pertence ao projeto;
- vaga está aberta;
- candidatura duplicada deve ser tratada;
- usuário não pode se candidatar ao próprio projeto;
- usuário já membro não pode se candidatar novamente.

## Frontend

Projeto:

```text
Vagas abertas

Backend Developer
2 vagas
[ Candidatar-me ]
```

Owner visualiza candidatura com:

```text
João Silva
Vaga: Backend
Compatibilidade futura: 88%
Tecnologias: Node.js, SQL
```

## Critério de aceite

Toda candidatura nova pode estar ligada a uma vaga e a aprovação atualiza ocupação da vaga.

---

# 9. ETAPA 6 — Função do membro dentro do projeto

## Objetivo

Registrar o papel real de cada membro do squad.

## Banco

Alterar `membros_equipe`:

```sql
ALTER TABLE membros_equipe
ADD COLUMN vaga_id INT NULL,
ADD COLUMN funcao_id INT NULL,
ADD COLUMN status ENUM('ativo','saiu','removido') DEFAULT 'ativo',
ADD COLUMN saiu_em DATETIME NULL,
ADD FOREIGN KEY (vaga_id) REFERENCES vagas_projeto(id) ON DELETE SET NULL,
ADD FOREIGN KEY (funcao_id) REFERENCES funcoes(id) ON DELETE SET NULL;
```

## Regras

- aceitar candidatura cria/atualiza membro;
- função vem preferencialmente da vaga;
- owner continua com papel Owner;
- histórico do membro não deve ser apagado quando sair.

## Alteração importante

Evitar `DELETE` físico em membros quando a pessoa sai, se isso destruir histórico.

Preferir soft-state:

```text
ativo
saiu
removido
```

## Critério de aceite

Projeto consegue mostrar “quem faz o quê” e preservar histórico.

---

# 10. ETAPA 7 — Tasks com habilidades e dificuldade

## Objetivo

Permitir que tarefas indiquem o conhecimento esperado e alimentem recomendação futura.

## Banco

Criar:

```sql
CREATE TABLE habilidades_tarefa (
    tarefa_id INT NOT NULL,
    habilidade_id INT NOT NULL,
    PRIMARY KEY (tarefa_id, habilidade_id),
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE
);
```

Alterar `tarefas`:

```sql
ALTER TABLE tarefas
ADD COLUMN dificuldade ENUM('iniciante','intermediaria','avancada') DEFAULT 'intermediaria';
```

## Backend

Alterar:

```text
src/controllers/tarefas.js
```

Payload de criação/edição:

```json
{
  "titulo": "Criar API de Login",
  "dificuldade": "intermediaria",
  "habilidades": [1, 7, 9]
}
```

## Frontend

Modal de task:

```text
Habilidades
Node.js · Express · JWT

Dificuldade
Intermediária
```

## Critério de aceite

Tasks podem ser filtradas/recomendadas por habilidade e dificuldade.

---

# 11. ETAPA 8 — Task assumível com concorrência segura

## Objetivo

Permitir que membros assumam tasks sem responsável.

## Backend

Criar endpoint:

```text
POST /projetos/:projetoId/tarefas/:tarefaId/assumir
```

Criar função transacional em `tarefas.js` ou service dedicado.

SQL conceitual:

```sql
UPDATE tarefas
SET responsavel_id = ?, status = 'doing'
WHERE id = ?
  AND projeto_id = ?
  AND responsavel_id IS NULL;
```

Validar `affectedRows = 1`.

Se 0:

```text
409 Conflict
Esta tarefa já foi assumida.
```

## Banco

Adicionar:

```sql
ALTER TABLE tarefas
ADD COLUMN assumida_em DATETIME NULL;
```

## Frontend

Card sem responsável:

```text
Sem responsável
[ Assumir tarefa ]
```

## Critério de aceite

Dois usuários clicando simultaneamente nunca podem assumir a mesma task.

---

# 12. ETAPA 9 — Abandonar, remover responsável e reatribuir task

## Objetivo

Tratar abandono sem perder histórico.

## Banco — criar histórico de responsáveis

```sql
CREATE TABLE historico_responsaveis_tarefa (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tarefa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    acao ENUM('assumiu','abandonou','removido','reatribuido','concluiu') NOT NULL,
    realizado_por INT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (realizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);
```

## Endpoints

```text
POST /projetos/:projetoId/tarefas/:tarefaId/abandonar
POST /projetos/:projetoId/tarefas/:tarefaId/remover-responsavel
POST /projetos/:projetoId/tarefas/:tarefaId/reatribuir
GET  /projetos/:projetoId/tarefas/:tarefaId/historico-responsaveis
```

## Regras

### Abandonar

- apenas responsável atual;
- `responsavel_id -> NULL`;
- status volta para `todo` ou regra definida;
- commits já registrados permanecem;
- histórico permanece.

### Remover responsável

- somente owner;
- registrar quem removeu.

### Reatribuir

- somente owner ou regra de projeto;
- novo responsável deve ser membro ativo.

## Critério de aceite

Nenhuma troca de responsável apaga evidência de contribuição anterior.

---

# 13. ETAPA 10 — Histórico permanente de participação

## Objetivo

Garantir que sair de um projeto não apague contribuições passadas.

## Alterações

Revisar todos os fluxos que hoje usam `DELETE` em:

```text
membros_equipe
candidaturas
tarefas
avaliações
```

## Regra

Contribuições históricas devem continuar vinculadas a usuário/projeto mesmo se membro sair.

## Backend

Alterar `membros.js` para saída lógica quando necessário.

Adicionar endpoint opcional:

```text
POST /projetos/:projetoId/sair
```

## Frontend

Perfil deve continuar mostrando projeto no histórico:

```text
Projeto X
Participou como Backend
Período: jan–mar
3 tasks verificadas
```

## Critério de aceite

Remover/sair do squad não elimina portfólio nem métricas históricas legítimas.

---

# 14. ETAPA 11 — Portfólio verificável

## Objetivo

Transformar entregas GitHub em evidência profissional visível no perfil.

## Backend — endpoint

```text
GET /usuarios/:id/portfolio
```

Retorno agregado:

```json
{
  "projetos": [
    {
      "projetoId": 5,
      "projetoNome": "Sistema Financeiro",
      "funcao": "Backend",
      "tasksVerificadas": 4,
      "commits": 32,
      "prsMergeados": 4,
      "tecnologias": ["Node.js", "MySQL"],
      "contribuicoes": []
    }
  ]
}
```

## Backend — arquivos sugeridos

Criar:

```text
src/controllers/portfolio.js
src/services/portfolio.js
```

Alterar:

```text
src/routes/routes.js
```

## Frontend

Criar:

```text
src/components/profile/VerifiedContributions.tsx
```

Exibir:

```text
Contribuições verificadas

Sistema Financeiro
Backend Developer

✓ API de autenticação
  PR #15 mergeado
  8 commits

✓ Recuperação de senha
  PR #27 mergeado
  5 commits
```

## Regra de privacidade

Para repositórios privados, não exibir detalhes técnicos publicamente sem regra explícita de visibilidade.

Pode mostrar apenas:

```text
Contribuição verificada em projeto privado
```

## Critério de aceite

Perfil público consegue mostrar evidências sem vazar dados privados.

---

# 15. ETAPA 12 — Separar XP de reputação técnica

## Objetivo

Impedir que gamificação seja confundida com qualidade técnica.

## Conceitos

### XP

Representa atividade/engajamento.

Exemplos:

- concluir task;
- participar;
- colaborar;
- receber avaliação.

### Reputação técnica

Representa evidência de entrega e confiança.

Exemplos:

- tasks verificadas por merge;
- PRs mergeados;
- avaliações de projeto;
- consistência de participação;
- colaboração técnica.

## Banco

Criar tabela:

```sql
CREATE TABLE reputacao_tecnica_usuario (
    usuario_id INT PRIMARY KEY,
    score DECIMAL(10,2) DEFAULT 0,
    tasks_verificadas INT DEFAULT 0,
    prs_mergeados INT DEFAULT 0,
    commits_validos INT DEFAULT 0,
    projetos_com_entrega INT DEFAULT 0,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
```

## Backend

Criar:

```text
src/services/reputacaoTecnica.js
```

Nunca calcular score confiando em valores vindos do frontend.

## Frontend

No perfil separar visualmente:

```text
Nível/XP
Reputação técnica
```

## Critério de aceite

Subir XP não altera automaticamente reputação técnica.

---

# 16. ETAPA 13 — Top Committers e Top Contributors

## Objetivo

Criar rankings úteis sem incentivar spam de commits.

## Rankings

### Top Committers

Volume bruto de commits válidos vinculados a tasks MontesSquad.

### Top Contributors

Ranking principal com ponderação.

Exemplo de score inicial:

```text
commit válido vinculado       +1
PR aberto                      +5
PR mergeado                   +30
task verificada por merge     +50
```

Aplicar teto de pontos por commits dentro da mesma task para reduzir manipulação.

## Backend

Criar:

```text
src/controllers/rankings.js
src/services/rankings.js
```

Endpoints:

```text
GET /projetos/:projetoId/rankings/committers
GET /projetos/:projetoId/rankings/contributors
GET /rankings/committers
GET /rankings/contributors
```

Filtros opcionais:

```text
?periodo=30d
?limit=10
```

## Frontend

Criar:

```text
src/components/projects/TopCommitters.tsx
src/components/projects/TopContributors.tsx
src/components/rankings/GlobalRankings.tsx
```

## Critério de aceite

Ranking global considera somente eventos vinculados a projetos/tasks do MontesSquad.

---

# 17. ETAPA 14 — Privacidade e repositórios privados

## Objetivo

Garantir que integração GitHub não exponha conteúdo privado.

## Regras obrigatórias

1. visitante não vê detalhes GitHub privados;
2. usuário fora do projeto não vê branch/commit/PR privado;
3. portfólio público não mostra mensagem de commit privada sem autorização;
4. URL privada não deve ser exposta indevidamente;
5. tokens nunca vão para frontend;
6. logs não devem conter secrets;
7. payloads devem ser minimizados.

## Backend

Criar helper/service:

```text
src/services/githubPrivacy.js
```

Funções conceituais:

```js
canViewRepositoryActivity(userId, projectId)
canExposeContributionPublicly(projectId, contribution)
```

## Banco

Adicionar em projetos:

```sql
ALTER TABLE projetos
ADD COLUMN visibilidade ENUM('publico','privado') DEFAULT 'publico';
```

Adicionar controle de exposição de portfólio se necessário:

```sql
ALTER TABLE projetos
ADD COLUMN permitir_portfolio_publico BOOLEAN DEFAULT TRUE;
```

## Critério de aceite

Teste explícito comprova que usuário não autorizado não recebe dados técnicos privados pela API.

---

# 18. ETAPA 15 — Timeline de atividade do projeto

## Objetivo

Criar histórico legível das principais ações do squad.

Eventos:

```text
membro entrou
membro saiu
task criada
task assumida
task abandonada
commit detectado
PR aberto
PR mergeado
task concluída
reavaliação
```

## Banco

Criar:

```sql
CREATE TABLE eventos_projeto (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    projeto_id INT NOT NULL,
    usuario_id INT NULL,
    tipo VARCHAR(100) NOT NULL,
    entidade_tipo VARCHAR(50) NULL,
    entidade_id VARCHAR(100) NULL,
    titulo VARCHAR(255) NOT NULL,
    metadados JSON NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
```

## Backend

Criar:

```text
src/services/eventosProjeto.js
src/controllers/eventosProjeto.js
```

Endpoint:

```text
GET /projetos/:projetoId/eventos
```

## Frontend

Criar:

```text
src/components/projects/ProjectTimeline.tsx
```

## Critério de aceite

Timeline não substitui logs técnicos; é uma visão de produto para usuários.

---

# 19. ETAPA 16 — Matching Desenvolvedor ↔ Projeto

## Objetivo

Recomendar projetos compatíveis com o perfil do usuário.

## MVP de matching

Não usar IA inicialmente.

Score determinístico:

```text
habilidades em comum
funções procuradas
nível desejado
vagas abertas
disponibilidade
interesse do usuário
```

Exemplo:

```text
Sistema Financeiro
Compatibilidade: 92%

Node.js ✓
SQL ✓
Backend ✓
Disponibilidade compatível ✓
```

## Backend

Criar:

```text
src/services/matching.js
src/controllers/matching.js
```

Endpoint:

```text
GET /matching/projetos
```

## Algoritmo inicial sugerido

```text
40% habilidades
25% função
15% nível
10% disponibilidade
10% outras afinidades
```

Documentar pesos em código.

## Frontend

Criar seção:

```text
Recomendados para você
```

## Critério de aceite

Score precisa ser explicável: API retorna os fatores que justificaram a recomendação.

---

# 20. ETAPA 17 — Matching Desenvolvedor ↔ Task

## Objetivo

Recomendar tasks do projeto adequadas ao membro.

Considerar:

- habilidades do usuário;
- habilidades da task;
- dificuldade;
- função no projeto;
- disponibilidade;
- task sem responsável;

Endpoint:

```text
GET /projetos/:projetoId/tasks/recomendadas
```

Retorno:

```json
{
  "taskId": 38,
  "compatibilidade": 95,
  "motivos": [
    "Node.js compatível",
    "SQL compatível",
    "JWT é oportunidade de aprendizado"
  ]
}
```

## Frontend

Exibir:

```text
Tasks recomendadas para você
```

## Regra

Não bloquear usuário de assumir task por score baixo; matching é recomendação, não autorização.

## Critério de aceite

Recomendação é transparente e não impede escolha manual.

---

# 21. ETAPA 18 — Revisão de segurança, regressão e E2E

## Objetivo

Validar o fluxo completo como produto integrado.

## Cenário E2E principal

```text
1. usuário cria conta com GitHub
2. completa perfil
3. cria projeto
4. define vagas
5. outro usuário se cadastra
6. recebe projeto recomendado
7. candidata-se para Backend
8. owner aceita
9. usuário vira membro Backend
10. owner cria task com Node.js/SQL
11. task aparece recomendada
12. usuário assume
13. GitHub registra commits
14. PR abre
15. PR mergeia
16. task conclui
17. XP é atualizado
18. reputação técnica é atualizada
19. ranking é atualizado
20. portfólio mostra contribuição
21. timeline mostra os eventos
```

## Testes de segurança

- IDOR em projetos;
- IDOR em tasks;
- usuário tentando assumir task fora do projeto;
- usuário alterando vaga de outro projeto;
- acesso a repositório privado;
- duplicate OAuth account;
- replay de callback/state;
- race condition ao assumir task;
- ranking manipulado por duplicidade;
- histórico preservado após saída.

## Critério final

Nenhuma funcionalidade nova pode quebrar:

```text
login local
cadastro local
projetos existentes
candidaturas atuais
mural
kanban
notificações
reputação atual
```

---

# 22. Ordem oficial de implementação

```text
ETAPA 0  Baseline
ETAPA 1  Login/cadastro GitHub OAuth
ETAPA 2  Conectar GitHub dentro do sistema
ETAPA 3  Perfil técnico completo
ETAPA 4  Papéis/vagas do projeto
ETAPA 5  Candidatura direcionada
ETAPA 6  Função do membro
ETAPA 7  Skills/dificuldade da task
ETAPA 8  Task assumível
ETAPA 9  Abandono/reatribuição
ETAPA 10 Histórico permanente
ETAPA 11 Portfólio verificável
ETAPA 12 XP x reputação técnica
ETAPA 13 Rankings
ETAPA 14 Privacidade
ETAPA 15 Timeline
ETAPA 16 Match usuário ↔ projeto
ETAPA 17 Match usuário ↔ task
ETAPA 18 Segurança/regressão/E2E
```

Nunca pular uma etapa apenas porque a seguinte parece independente. Se houver dependência técnica descoberta, registrar no documento e ajustar a execução conscientemente.

---

# 23. Mapa de arquivos novos esperados

## Backend

```text
src/services/githubOAuth.js
src/controllers/githubConta.js
src/controllers/vagasProjeto.js
src/controllers/portfolio.js
src/controllers/rankings.js
src/controllers/matching.js
src/controllers/eventosProjeto.js

src/services/portfolio.js
src/services/reputacaoTecnica.js
src/services/rankings.js
src/services/githubPrivacy.js
src/services/matching.js
src/services/eventosProjeto.js

scripts/migrar_evolucao_produto.js
```

## Frontend

```text
src/components/settings/GitHubConnectionCard.tsx
src/components/profile/VerifiedContributions.tsx
src/components/projects/ProjectTimeline.tsx
src/components/projects/TopCommitters.tsx
src/components/projects/TopContributors.tsx
src/components/rankings/GlobalRankings.tsx
src/components/projects/ProjectRoles.tsx
src/components/projects/RecommendedTasks.tsx
src/components/projects/ProjectMatches.tsx
```

Adaptar nomes ao padrão real encontrado no projeto.

---

# 24. Prompt mestre para agente de implementação

```text
Você é o engenheiro responsável por executar o plano de evolução do MontesSquad.

Leia integralmente:
- docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md
- docs/IMPLEMENTACAO_GITHUB_KANBAN.md
- README.md
- package.json
- banco atual
- controllers atuais
- services atuais
- frontend relacionado.

REGRA ABSOLUTA:
Implemente uma etapa por vez. Não altere arquivos da etapa seguinte enquanto o gate da etapa atual não estiver completamente fechado.

Se estiver aguardando subagentes da etapa atual, você pode analisar a etapa seguinte, mapear dependências, riscos, arquivos e distribuição futura, mas não implementar nada da próxima etapa.

EM CADA ETAPA:
1. confirme o estado atual dos arquivos;
2. liste exatamente quais arquivos serão criados;
3. liste exatamente quais arquivos serão alterados;
4. implemente banco/migration primeiro quando necessário;
5. implemente backend;
6. implemente frontend quando aplicável;
7. adicione testes;
8. rode testes;
9. rode lint;
10. revise segurança;
11. verifique regressões;
12. valide critérios de aceite;
13. registre arquivos alterados;
14. só então avance.

NÃO:
- introduza ORM;
- substitua MySQL;
- remova fluxos existentes sem necessidade;
- confie em autorização do frontend;
- apague histórico legítimo de contribuição;
- exponha dados de repositórios privados;
- confunda XP com reputação técnica;
- use quantidade de commits como única medida de contribuição;
- use IA para matching no MVP quando regras determinísticas forem suficientes.

OBJETIVO FINAL:
Transformar MontesSquad em uma plataforma onde usuários encontram projetos compatíveis, entram em squads, assumem tarefas adequadas, realizam contribuições verificadas e constroem portfólio e reputação técnica com evidências reais.
```

---

# 25. Critério de produto final

A evolução só está realmente concluída quando o MontesSquad consegue representar o ciclo completo:

```text
IDENTIDADE
   ↓
PERFIL TÉCNICO
   ↓
DESCOBERTA DE PROJETO
   ↓
CANDIDATURA PARA UMA FUNÇÃO
   ↓
ENTRADA NO SQUAD
   ↓
TASK ADEQUADA
   ↓
CONTRIBUIÇÃO
   ↓
EVIDÊNCIA GITHUB
   ↓
CONCLUSÃO VERIFICADA
   ↓
PORTFÓLIO
   ↓
REPUTAÇÃO
   ↓
NOVAS OPORTUNIDADES
```

Esse ciclo deve ser o núcleo do produto.