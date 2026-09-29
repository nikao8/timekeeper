# Timekeeper — atalhos para instalar, migrar, buildar e subir o projeto.
# Uso: make <alvo>   |   make help

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Prefer an explicit PNPM=…, then PATH, then the Corepack user shim, then `corepack pnpm`.
ifndef PNPM
  PNPM := $(shell command -v pnpm 2>/dev/null)
  ifeq ($(PNPM),)
    ifneq ($(wildcard $(HOME)/.local/bin/pnpm),)
      PNPM := $(HOME)/.local/bin/pnpm
    else
      PNPM := corepack pnpm
    endif
  endif
endif
# package.json scripts call `pnpm` again via `sh`; keep the resolved binary on PATH.
ifneq ($(findstring /,$(PNPM)),)
  export PATH := $(dir $(PNPM)):$(PATH)
endif

.PHONY: help setup env install db-generate db-migrate db-seed db-reset db-studio \
	dev start dev-api dev-web build lint test clean

help: ## Lista os comandos disponíveis
	@awk 'BEGIN {FS = ":.*##"; printf "\nTimekeeper\n\n"} \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf "\nFluxo local típico:  make setup && make start\n\n"

# ---------------------------------------------------------------------------
# Primeira execução
# ---------------------------------------------------------------------------

setup: env install db-generate db-migrate db-seed ## Instala deps, migra o banco (Turso, se configurado) e popula
	@echo ""
	@echo "Pronto. Suba o projeto com:  make start"
	@echo "  Web  http://localhost:3000"
	@echo "  API  http://localhost:3001"
	@echo "  Docs http://localhost:3001/docs"
	@echo "  Gestor      gestor@example.com / Timekeeper@123"
	@echo "  Funcionário funcionario@example.com / Timekeeper@123"

env: ## Cria o .env da raiz a partir do exemplo (não sobrescreve)
	@if [ ! -f .env ]; then cp .env.example .env && echo "Criado .env"; else echo ".env já existe"; fi
	@if [ ! -f apps/web/.env.local ]; then \
		printf 'NEXT_PUBLIC_API_URL=http://localhost:3001\n' > apps/web/.env.local && echo "Criado apps/web/.env.local"; \
	else echo "apps/web/.env.local já existe"; fi

install: ## Instala as dependências do monorepo
	$(PNPM) install

# ---------------------------------------------------------------------------
# Banco (Turso / libSQL; SQLite local só para gerar migrations)
# ---------------------------------------------------------------------------

db-generate: ## Gera o Prisma Client
	$(PNPM) db:generate

db-migrate: ## Gera a migration local e aplica no Turso quando houver credenciais
	$(PNPM) db:migrate

db-seed: ## Popula o banco (Turso, se TURSO_* estiver definido; senão o SQLite local)
	$(PNPM) db:seed

db-reset: ## Recria o schema local, aplica no Turso e executa o seed
	$(PNPM) --filter @timekeeper/api exec node --env-file=../../.env ./node_modules/prisma/build/index.js migrate reset --force
	$(PNPM) --filter @timekeeper/api exec node --env-file=../../.env --import tsx prisma/apply-turso.ts

db-studio: ## Abre o Prisma Studio no SQLite local
	$(PNPM) db:studio

# ---------------------------------------------------------------------------
# Desenvolvimento local
# ---------------------------------------------------------------------------

start: ## Inicia API + Web
	$(PNPM) dev

dev: start ## Alias de start

dev-api: ## Inicia só a API (NestJS)
	$(PNPM) dev:api

dev-web: ## Inicia só o frontend (Next.js)
	$(PNPM) dev:web

# ---------------------------------------------------------------------------
# Qualidade / artefatos
# ---------------------------------------------------------------------------

build: ## Compila shared, API e web (produção)
	$(PNPM) build

lint: ## Executa o linter em todos os pacotes
	$(PNPM) lint

test: ## Executa os testes unitários da API
	$(PNPM) test

clean: ## Remove node_modules e builds
	rm -rf node_modules apps/api/node_modules apps/web/node_modules packages/shared/node_modules
	rm -rf apps/api/dist apps/web/.next packages/shared/dist
