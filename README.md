# MonteSquad API

API em Node.js com Express e MySQL para o TCC.

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
RESET_PASSWORD_URL=http://localhost:3000/resetar?token=
```

## Autenticação

### `POST /login`
Envia `email` e `senha` e recebe um token JWT.

### `POST /recuperar-senha`
Envia `email` e gera um token temporário para redefinição de senha, com envio de e-mail via Mailtrap.

### `POST /resetar-senha`
Envia `token` e `novaSenha` para atualizar a senha do usuário.

## Usuários

Ao cadastrar um usuário novo, a senha é armazenada com hash usando `bcryptjs`.

## Execução

```bash
npm run dev
```
