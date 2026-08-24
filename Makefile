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
COMPOSE ?= docker compose
POSTGRES_USER ?= timekeeper
POSTGRES_DB ?= timekeeper

.PHONY: help setup env install postgres postgres-wait db-generate db-migrate db-seed db-reset db-studio \
	dev start dev-api dev-web build lint test up down logs docker-up docker-down docker-build docker-rebuild clean

help: ## Lista os comandos disponíveis
	@awk 'BEGIN {FS = ":.*##"; printf "\nTimekeeper\n\n"} \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@printf "\nFluxo local típico:  make setup && make start\n"
	@printf "Stack Docker:        make docker-up\n\n"

# ---------------------------------------------------------------------------
# Primeira execução
# ---------------------------------------------------------------------------

setup: env install postgres postgres-wait db-generate db-migrate db-seed ## Instala deps, sobe o Postgres, migra e popula o banco
	@echo ""
	@echo "Pronto. Suba o projeto com:  make start"
	@echo "  Web  http://localhost:3000"
	@echo "  API  http://localhost:3001"
	@echo "  Docs http://localhost:3001/docs"
	@echo "  Gestor      gestor@example.com / Timekeeper@123"
	@echo "  Funcionário funcionario@example.com / Timekeeper@123"

env: ## Cria .env e apps/api/.env a partir do exemplo (não sobrescreve)
	@if [ ! -f .env ]; then cp .env.example .env && echo "Criado .env"; else echo ".env já existe"; fi
	@if [ ! -f apps/api/.env ]; then cp .env.example apps/api/.env && echo "Criado apps/api/.env"; else echo "apps/api/.env já existe"; fi
	@if [ ! -f apps/web/.env.local ]; then \
		printf 'NEXT_PUBLIC_API_URL=http://localhost:3001\n' > apps/web/.env.local && echo "Criado apps/web/.env.local"; \
	else echo "apps/web/.env.local já existe"; fi

install: ## Instala as dependências do monorepo
	$(PNPM) install

# ---------------------------------------------------------------------------
# Banco (Docker — só PostgreSQL)
# ---------------------------------------------------------------------------

postgres: ## Sobe o PostgreSQL em background
	$(COMPOSE) up -d postgres

postgres-wait: ## Aguarda o PostgreSQL ficar healthy
	@echo "Aguardando PostgreSQL..."
	@for i in $$(seq 1 30); do \
		if $(COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; then \
			echo "PostgreSQL pronto."; exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "PostgreSQL não respondeu a tempo." >&2; exit 1

db-generate: ## Gera o Prisma Client
	$(PNPM) db:generate

db-migrate: ## Aplica migrations (desenvolvimento)
	$(PNPM) db:migrate

db-seed: ## Popula o banco com dados de desenvolvimento
	$(PNPM) db:seed

db-reset: postgres postgres-wait ## Recria o schema, aplica migrations e executa o seed
	$(PNPM) --filter @timekeeper/api exec prisma migrate reset --force

db-studio: ## Abre o Prisma Studio
	$(PNPM) db:studio

# ---------------------------------------------------------------------------
# Desenvolvimento local (API + Web fora do Docker)
# ---------------------------------------------------------------------------

start: postgres postgres-wait ## Sobe Postgres (se necessário) e inicia API + Web
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

# ---------------------------------------------------------------------------
# Docker — stack completa (postgres + api + web)
# ---------------------------------------------------------------------------

up: postgres ## Sobe só o Postgres (uso local com pnpm)
	@echo "Postgres em localhost:5432. Use make start para API e web."

docker-up: env ## Builda e sobe postgres + api + web em containers
	$(COMPOSE) --profile full up --build -d
	@echo "Web  http://localhost:3000"
	@echo "API  http://localhost:3001"

docker-build: ## Builda as imagens da API e do web sem subir
	$(COMPOSE) --profile full build

docker-rebuild: ## Rebuilda as imagens sem cache e sobe a stack
	$(COMPOSE) --profile full build --no-cache
	$(COMPOSE) --profile full up -d

docker-down: ## Para a stack Docker (mantém o volume do Postgres)
	$(COMPOSE) --profile full down

down: ## Para o Postgres (e a stack full, se estiver no ar)
	$(COMPOSE) --profile full down

logs: ## Acompanha os logs do Compose
	$(COMPOSE) --profile full logs -f

clean: ## Remove node_modules, builds e containers (mantém o volume do banco)
	$(COMPOSE) --profile full down
	rm -rf node_modules apps/api/node_modules apps/web/node_modules packages/shared/node_modules
	rm -rf apps/api/dist apps/web/.next packages/shared/dist
