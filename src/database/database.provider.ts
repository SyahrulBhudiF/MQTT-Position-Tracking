import { PgDrizzle, layer as pgDrizzleLayer } from "@effect/sql-drizzle/Pg";
import { PgClient } from "@effect/sql-pg";
import { Duration, Layer, Redacted } from "effect";

export { PgDrizzle };

export const PgClientLive = PgClient.layer({
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: Redacted.make(process.env.POSTGRES_PASSWORD ?? ""),
  database: process.env.POSTGRES_DATABASE ?? "tracking",
  maxConnections: 10,
  idleTimeout: Duration.seconds(20),
  connectTimeout: Duration.seconds(10),
});

export const PgDrizzleLive = pgDrizzleLayer.pipe(Layer.provide(PgClientLive));

export const DatabaseLive = PgDrizzleLive;
