# AGENTS.md — Regras Absolutas para Agentes de IA

> Este arquivo define as regras que **todo agente de IA** DEVE seguir ao interagir com este repositório.

---

## ⚠️ REGRA #1: Skill-Scanning Obrigatório

**ANTES de qualquer tarefa**, escanear e carregar skills relevantes:

```yaml
- spec-a23                # Desenvolvimento spec-driven
- backend-security-audit  # Análise de segurança estática
- codebase-health-check   # Verificação pré-flight do código
```

---

## 📝 REGRA #2: Commits

- **Idioma:** português brasileiro OBRIGATÓRIO
- **Formato:** Conventional Commits em PT-BR: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- **Nunca** commitar código quebrado (type-check + build + testes antes)

---

## 🚫 REGRA #3: Restrições

- **NÃO** modificar `node_modules/`, `dist/`, `.env`
- **NÃO** fazer deploy sem comando explícito
- **NÃO** expor segredos em logs ou outputs

---

## Codex + verboo-bridge

**Codex é APENAS planejador/orquestrador — NUNCA implementa código diretamente.**

### Fluxo

1. Codex **planeia** as etapas, estrutura o plano, define o que precisa ser feito
2. Codex chama `@verboo_agent` para **toda** execução — análise, código, refatoração
3. `verboo-bridge` classifica a tarefa e roteia para o melhor modelo Verboo
4. Codex **revisa** o retorno, roda bash/testes, **nunca implementa**

### Regras

- `@verboo_agent` modo `read_only` → análise, auditoria, revisão de código
- `@verboo_agent` modo `write` → implementação, edição, refatoração
- Codex **só faz**: planejar, revisar diff, rodar bash/testes, commitar em PT-BR
- Código zero do Codex — toda implementação passa pelo Verboo
