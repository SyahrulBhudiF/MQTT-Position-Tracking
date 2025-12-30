# AGENT.md
# Backend Agent — Real-Time Participant Tracking System
**Stack:** TypeScript · NestJS · Bun (primary) / pnpm+Node.js (fallback) · MQTT · WebSocket · Redis · PostgreSQL · Effect · BiomeJS

---

## 0. Ringkasan singkat
Dokumen ini adalah satu file `.md` otoritatif untuk implementasi backend tracking posisi peserta lomba real-time. Mengikuti NestJS best practices (modular, clean architecture), Effect sebagai core business logic, dan BiomeJS sebagai code-style tooling.

Referensi best practice:
- NestJS Docs: https://docs.nestjs.com/
- Fallback repo: https://github.com/SyahrulBhudiF/Document-management

---

## 1. Tujuan
Backend bertanggung jawab menerima update GPS dari perangkat mobile via MQTT, memproses & memvalidasi payload secara type-safe, menyimpan posisi realtime + histori, dan mendorong update ke dashboard via WebSocket.

Semua business logic WAJIB berada di dalam Effect.

---

## 2. Prinsip desain
- Modular NestJS architecture
- Separation of concerns
- Event-driven processing
- Stateless services
- Explicit error handling (Effect)
- Bun-first, pnpm fallback

---

## 3. Tech stack
- Language: TypeScript
- Framework: NestJS
- Runtime: Bun (primary), pnpm + Node.js 20+ (fallback)
- MQTT: mqtt.js
- WebSocket: @nestjs/websockets
- Cache: Redis
- Database: PostgreSQL
- Functional core: Effect
- Tooling: BiomeJS

---

## 4. Non-negotiable rules
1. No business logic in controllers or gateways
2. Effect handles all domain logic
3. Infrastructure is adapter-only
4. Typed DTOs everywhere
5. No silent errors

---

## 5. High-level data flow
```
Mobile App
  -> MQTT Broker
    -> mqtt.subscriber
      -> Effect pipeline
        -> Redis / PostgreSQL
          -> WebSocket Gateway
            -> Dashboard
```

---

## 6. Folder structure (mandatory)
```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── config.module.ts
│   └── config.service.ts
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── mqtt/
│   ├── mqtt.module.ts
│   ├── mqtt.client.ts
│   └── mqtt.subscriber.ts
├── tracking/
│   ├── dto/
│   ├── entities/
│   ├── tracking.module.ts
│   ├── tracking.service.ts
│   ├── tracking.effects.ts
│   ├── tracking.repository.ts
│   └── tracking.errors.ts
├── realtime/
│   ├── realtime.module.ts
│   └── realtime.gateway.ts
├── storage/
│   ├── storage.module.ts
│   ├── redis.service.ts
│   └── postgres.service.ts
└── shared/
    ├── effect/
    └── types/
```

---

## 7. MQTT payload spec
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

Rules:
- Validate range & enum
- Preserve client timestamp
- Add server_received_at
- Drop stale data

---

## 8. Effect best practices
Before implementing Effect features, run:
```bash
effect-solutions list
```

Topics:
- services and layers
- data modeling
- error handling
- configuration
- testing
- HTTP clients
- CLIs
- observability
- project structure

Effect source reference:
```
https://effect.website/docs/code-style/guidelines/
```

---

## 9. Storage strategy
### Redis
- Key: race:{race_id}:participant:{participant_id}:last
- Value: last known position DTO

### PostgreSQL
- Table: tracking_positions
- Indexed by participant_id and timestamp

---

## 10. WebSocket realtime
- Implemented with NestJS Gateway
- Emits only after Effect success
- Guarded with auth

---

## 11. Security
- MQTT auth + ACL
- Dashboard protected by NestJS Guards
- No public raw tracking data

---

## 12. BiomeJS config
```json
{
  "files": {
    "includes": ["**", "!.idea", "!**/node_modules", "!**/dist", "!**/build"],
    "ignoreUnknown": false
  }
}
```

Guidelines:
https://effect.website/docs/code-style/guidelines/

---

## 13. Runtime & scripts
- Bun primary
- pnpm fallback

---

## 14. Checklist
- Effect-only domain logic
- Biome passes
- MQTT → WS tested
- Bun & pnpm validated

---

## 15. Status
This file is the single source of truth for backend implementation.
https://github.com/SyahrulBhudiF/Document-management
