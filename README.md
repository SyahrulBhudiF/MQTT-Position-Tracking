# Real-Time Participant Tracking System

A high-performance backend system for real-time GPS tracking of race participants. Built with NestJS, Effect, MQTT, WebSocket, Redis, PostgreSQL, and Drizzle ORM.

## 🚀 Features

- **Real-time GPS Tracking**: Receive position updates from mobile devices via MQTT
- **WebSocket Broadcasting**: Push live updates to dashboard clients
- **Type-safe Processing**: Effect-based business logic with comprehensive error handling
- **Dual Storage**: Redis for real-time cache, PostgreSQL for historical data
- **Drizzle ORM**: Type-safe database operations with automatic migrations
- **Modular Architecture**: Clean, maintainable NestJS module structure
- **Bun-first Runtime**: Optimized for Bun with pnpm+Node.js fallback

## 📋 Prerequisites

- [Bun](https://bun.sh/) (v1.0+) or Node.js (v20+) with pnpm
- PostgreSQL (v14+)
- Redis (v6+)
- MQTT Broker (e.g., Mosquitto, EMQX, HiveMQ)

## 🛠️ Installation

### Using Bun (Recommended)

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Run database migrations
bun run db:migrate

# Start development server
bun run start:dev
```

### Using pnpm + Node.js (Fallback)

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Run database migrations
pnpm run db:migrate

# Start development server
pnpm run start:dev
```

## ⚙️ Configuration

Create a `.env` file based on `.env.example`:

```env
# Application
PORT=3000
NODE_ENV=development
STALE_DATA_THRESHOLD_MS=30000

# MQTT Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CLIENT_ID=tracking-backend
MQTT_TOPICS=tracking/+/position

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=your_password_here
POSTGRES_DATABASE=tracking

# WebSocket Configuration
WS_PORT=3001
WS_CORS_ORIGIN=*
WS_CORS_CREDENTIALS=true
```

## 📁 Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── config/                 # Configuration module
│   ├── config.module.ts
│   └── config.service.ts
├── database/               # Drizzle ORM setup
│   ├── database.module.ts
│   ├── database.provider.ts
│   └── schema.ts           # Database schema definitions
├── common/                 # Shared utilities
│   ├── decorators/         # Custom decorators
│   ├── filters/            # Exception filters
│   ├── guards/             # Auth guards
│   ├── interceptors/       # Logging interceptors
│   ├── pipes/              # Validation pipes
│   └── utils/              # Utility functions
├── mqtt/                   # MQTT module
│   ├── mqtt.module.ts
│   ├── mqtt.client.ts      # MQTT connection client
│   └── mqtt.subscriber.ts  # Message handler
├── tracking/               # Core tracking module
│   ├── dto/                # Data transfer objects
│   ├── tracking.module.ts
│   ├── tracking.service.ts
│   ├── tracking.effects.ts # Effect-based business logic
│   ├── tracking.repository.ts
│   └── tracking.errors.ts  # Typed errors
├── realtime/               # WebSocket module
│   ├── realtime.module.ts
│   └── realtime.gateway.ts
├── storage/                # Storage module
│   ├── storage.module.ts
│   ├── redis.service.ts
│   └── postgres.service.ts
└── shared/                 # Shared types and utilities
    ├── effect/             # Effect runtime utilities
    └── types/              # Type definitions

drizzle/                    # Drizzle migrations
├── 0000_sturdy_shotgun.sql # Initial migration
└── meta/                   # Migration metadata
```

## 🗄️ Database Migrations

This project uses **Drizzle ORM** for database management with type-safe migrations.

### Migration Commands

| Command | Description |
|---------|-------------|
| `bun run db:generate` | Generate new migration from schema changes |
| `bun run db:migrate` | Run pending migrations |
| `bun run db:push` | Push schema changes directly (dev only) |
| `bun run db:studio` | Open Drizzle Studio GUI |
| `bun run db:drop` | Drop a migration |

### Database Schema

The main table `tracking_positions` stores GPS position data:

```sql
CREATE TABLE "tracking_positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "participant_id" varchar(50) NOT NULL,
  "race_id" varchar(50) NOT NULL,
  "latitude" numeric(10, 7) NOT NULL,
  "longitude" numeric(10, 7) NOT NULL,
  "client_timestamp" timestamp with time zone NOT NULL,
  "server_received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" participant_status DEFAULT 'moving' NOT NULL
);
```

Indexes:
- `idx_tracking_participant_id` - Fast lookup by participant
- `idx_tracking_race_id` - Fast lookup by race
- `idx_tracking_participant_timestamp` - Composite index for history queries
- `idx_tracking_race_timestamp` - Composite index for race timeline queries

## 📡 MQTT Payload Specification

Send GPS updates to the configured MQTT topics with this JSON format:

```json
{
  "participant_id": "P001",
  "race_id": "R2025-07",
  "latitude": -7.9456,
  "longitude": 112.6145,
  "timestamp": "2025-07-01T08:15:30Z",
  "status": "moving"
}
```

### Status Values

- `moving` - Participant is actively moving
- `stopped` - Participant has stopped
- `finished` - Participant has finished the race
- `disqualified` - Participant is disqualified

## 🔌 WebSocket API

Connect to the WebSocket gateway at `ws://localhost:3000/tracking`

### Subscribe to Race Updates

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000/tracking');

// Subscribe to a race
socket.emit('subscribe_race', { raceId: 'R2025-07' });

// Listen for position updates
socket.on('position_update', (data) => {
  console.log('Position update:', data);
});

// Listen for batch updates
socket.on('batch_position_update', (data) => {
  console.log('Batch update:', data);
});

// Unsubscribe from a race
socket.emit('unsubscribe_race', { raceId: 'R2025-07' });
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `bun run start` | Start the application |
| `bun run start:dev` | Start in development mode with watch |
| `bun run start:debug` | Start in debug mode |
| `bun run start:prod` | Start in production mode |
| `bun run build` | Build the application |
| `bun run lint` | Run BiomeJS linter |
| `bun run format` | Format code with BiomeJS |
| `bun run check` | Run BiomeJS check (lint + format) |
| `bun run test` | Run unit tests |
| `bun run test:e2e` | Run end-to-end tests |
| `bun run db:generate` | Generate database migration |
| `bun run db:migrate` | Run database migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |

## 🏗️ Architecture

### Data Flow

```
Mobile App
  → MQTT Broker
    → mqtt.subscriber
      → Effect pipeline (validate → transform → store)
        → Redis (real-time cache)
        → PostgreSQL (historical data via Drizzle)
          → WebSocket Gateway
            → Dashboard
```

### Effect-based Processing

All business logic is implemented using Effect for:

- Type-safe error handling
- Composable pipelines
- Explicit failure modes
- No silent errors

### Storage Strategy

- **Redis**: Last known position for each participant (key: `race:{raceId}:participant:{participantId}:last`)
- **PostgreSQL**: Complete position history via Drizzle ORM, indexed by participant_id and timestamp

## 🔒 Security

- MQTT authentication via username/password
- WebSocket connections protected by auth guard
- No public access to raw tracking data
- CORS configuration for dashboard access

## 🧪 Testing

```bash
# Unit tests
bun run test

# Watch mode
bun run test:watch

# Coverage
bun run test:cov

# E2E tests
bun run test:e2e
```

## 📝 Code Style

This project uses [BiomeJS](https://biomejs.dev/) for linting and formatting. Configuration is in `biome.json`.

```bash
# Check code style
bun run check

# Auto-fix issues
bun run lint
bun run format
```

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in environment
2. Run database migrations: `bun run db:migrate`
3. Configure proper MQTT authentication
4. Set up proper WebSocket CORS origins
5. Use a process manager (PM2, Docker, etc.)

```bash
# Build for production
bun run build

# Run migrations
bun run db:migrate

# Start production server
bun run start:prod
```

## 📚 References

- [NestJS Documentation](https://docs.nestjs.com/)
- [Effect Documentation](https://effect.website/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [BiomeJS Documentation](https://biomejs.dev/)
- [MQTT.js Documentation](https://github.com/mqttjs/MQTT.js)

## 📄 License

UNLICENSED - Private project