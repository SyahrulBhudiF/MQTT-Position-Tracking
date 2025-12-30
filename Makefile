.PHONY: help dev dev-up dev-down dev-logs dev-ps db-migrate db-studio install build check lint format test clean

# Default target
help:
	@echo "🚀 Tracking Backend - Development Commands"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "📦 Setup:"
	@echo "  install       Install dependencies (bun)"
	@echo "  build         Build the application"
	@echo ""
	@echo "🐳 Docker (Infrastructure):"
	@echo "  dev-up        Start PostgreSQL, Redis, MQTT (exposed ports for dev)"
	@echo "  dev-down      Stop all Docker services"
	@echo "  dev-logs      Show Docker logs"
	@echo "  dev-ps        Show running containers"
	@echo ""
	@echo "🖥️  Development:"
	@echo "  dev           Start backend in dev mode (requires dev-up first)"
	@echo "  start         Start backend in production mode"
	@echo ""
	@echo "🗄️  Database:"
	@echo "  db-migrate    Run database migrations"
	@echo "  db-generate   Generate new migration from schema"
	@echo "  db-push       Push schema directly (dev only)"
	@echo "  db-studio     Open Drizzle Studio GUI"
	@echo ""
	@echo "🧹 Code Quality:"
	@echo "  check         Run BiomeJS check (lint + format)"
	@echo "  lint          Run linter and fix"
	@echo "  format        Format code"
	@echo "  test          Run tests"
	@echo ""
	@echo "🧼 Cleanup:"
	@echo "  clean         Remove build artifacts and node_modules"
	@echo "  clean-docker  Remove Docker volumes (⚠️  deletes data)"

# ============================================================================
# Setup
# ============================================================================

install:
	@echo "📦 Installing dependencies..."
	bun install

build:
	@echo "🔨 Building application..."
	bun run build

# ============================================================================
# Docker - Development Infrastructure
# ============================================================================

dev-up:
	@echo "🐳 Starting development infrastructure..."
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "✅ Services started:"
	@echo "   PostgreSQL: localhost:5432"
	@echo "   Redis:      localhost:6379"
	@echo "   MQTT:       localhost:1883"
	@echo ""
	@echo "Run 'make dev' to start the backend"

dev-down:
	@echo "🛑 Stopping development infrastructure..."
	docker compose -f docker-compose.dev.yml down

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

dev-ps:
	docker compose -f docker-compose.dev.yml ps

# ============================================================================
# Development Server
# ============================================================================

dev:
	@echo "🖥️  Starting backend in development mode..."
	bun run start:dev

start:
	@echo "🚀 Starting backend in production mode..."
	bun run start:prod

# ============================================================================
# Database
# ============================================================================

db-migrate:
	@echo "🗄️  Running database migrations..."
	bun run db:migrate

db-generate:
	@echo "🗄️  Generating migration from schema..."
	bun run db:generate

db-push:
	@echo "🗄️  Pushing schema to database..."
	bun run db:push

db-studio:
	@echo "🗄️  Opening Drizzle Studio..."
	bun run db:studio

# ============================================================================
# Code Quality
# ============================================================================

check:
	@echo "🔍 Running BiomeJS check..."
	bun run check

lint:
	@echo "🔍 Running linter..."
	bun run lint

format:
	@echo "✨ Formatting code..."
	bun run format

test:
	@echo "🧪 Running tests..."
	bun run test

# ============================================================================
# Cleanup
# ============================================================================

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist node_modules .turbo coverage

clean-docker:
	@echo "⚠️  Removing Docker volumes (this will delete all data)..."
	docker compose -f docker-compose.dev.yml down -v
