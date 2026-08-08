# MonteSquad API

API em Node.js com Express e MySQL para o TCC — plataforma de squads/projetos colaborativos.

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Configure um arquivo `.env` com pelo menos:

```env
BD_SERVIDOR=localhost
BD_PORTA=3306
BD_USUARIO=root
BD_SENHA=
BD_BANCO=montesquad

JWT_SECRET=coloque-um-segredo-forte-aqui
JWT_EXPIRES_IN=8h
JWT_RESET_SECRET=coloque-um-segredo-forte-aqui
JWT_RESET_EXPIRES_IN=15m

SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="MontesSquad <no-reply@montesquad.com>"
RESET_PASSWORD_URL=http://localhost:5173/resetar-senha?token=
FRONTEND_URL=http://localhost:5173
```

> ⚠️ `.env` está no `.gitignore` — nunca commitar credenciais reais.
> Veja `.env.example` para a lista completa de variáveis (sem valores reais).

## Credenciais de teste (seed — `src/database/createDatabase/Insert.sql`)

| E-mail | Senha | Tipo |
|---|---|---|
| `admin@email.com` | `admin123` | adm |
| `lucas@email.com` | `senha123` | membro |
| `fernanda@email.com` | `senha456` | membro |
| `roberto@email.com` | `senha789` | membro |
| `juliana@email.com` | `senha012` | membro |

> As senhas do seed são armazenadas com hash **bcrypt** — senha em texto puro é rejeitada (401).

## Autenticação

### `POST /login`
Envia `email` e `senha` e recebe um token JWT. **O token fica na raiz da resposta** (`json.token`), não dentro de `dados`.

### `POST /recuperar-senha`
Envia `email` e gera um token temporário para redefinição de senha, com envio de e-mail via Mailtrap.

### `POST /resetar-senha`
Envia `token` e `novaSenha` para atualizar a senha do usuário.

## Usuários

Ao cadastrar um usuário novo, a senha é armazenada com hash usando `bcryptjs`.

## Testes

```bash
npm test          # suíte Vitest + supertest (32 testes, pool mockado — não toca o MySQL real)
npm run test:watch
npm run db:setup  # aplica as migrações (scripts/migrar_fase01.js + migrar_fase02.js)
```

## Healthcheck

`GET /health` → `{ sucesso: true, banco: "ok" | "erro" }` — verifica a conexão com o banco sem derrubar o boot.

## Execução

```bash
npm run dev
```

O servidor sobe em `http://localhost:3333` (porta configurável via `PORT` no `.env`).
