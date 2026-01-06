import { Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Schema } from "effect";
import type { Server, Socket } from "socket.io";
import { WsAuthGuard } from "../common/guards/ws-auth.guard";
import type { PositionUpdateDto } from "../tracking/dto/tracking.dto";
import { SubscribeRaceSchema } from "../tracking/dto/tracking.dto";

interface SubscribedClient {
  socketId: string;
  raceIds: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true,
  },
  namespace: "/tracking",
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly subscribedClients = new Map<string, SubscribedClient>();

  afterInit(): void {
    this.logger.log("WebSocket Gateway initialized");
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.subscribedClients.set(client.id, {
      socketId: client.id,
      raceIds: new Set(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    const subscribedClient = this.subscribedClients.get(client.id);

    if (subscribedClient) {
      // Leave all race rooms
      for (const raceId of subscribedClient.raceIds) {
        client.leave(`race:${raceId}`);
      }
      this.subscribedClients.delete(client.id);
    }
  }

  /**
   * Handle subscription to race position updates
   */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage("subscribe_race")
  handleSubscribeRace(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: { success: boolean; message: string; raceId?: string };
  } {
    let raceId: string;
    try {
      const validated = Schema.decodeUnknownSync(SubscribeRaceSchema)(data);
      raceId = validated.raceId;
    } catch {
      return {
        event: "subscribe_race_response",
        data: {
          success: false,
          message: "Invalid race ID",
        },
      };
    }

    const roomName = `race:${raceId}`;

    // Join the race room
    client.join(roomName);

    // Track subscription
    const subscribedClient = this.subscribedClients.get(client.id);
    if (subscribedClient) {
      subscribedClient.raceIds.add(raceId);
    }

    this.logger.log(`Client ${client.id} subscribed to race ${raceId}`);

    return {
      event: "subscribe_race_response",
      data: {
        success: true,
        message: `Subscribed to race ${raceId}`,
        raceId,
      },
    };
  }

  /**
   * Handle unsubscription from race position updates
   */
  @SubscribeMessage("unsubscribe_race")
  handleUnsubscribeRace(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: { success: boolean; message: string; raceId?: string };
  } {
    let raceId: string;
    try {
      const validated = Schema.decodeUnknownSync(SubscribeRaceSchema)(data);
      raceId = validated.raceId;
    } catch {
      return {
        event: "unsubscribe_race_response",
        data: {
          success: false,
          message: "Invalid race ID",
        },
      };
    }

    const roomName = `race:${raceId}`;

    // Leave the race room
    client.leave(roomName);

    // Remove from tracking
    const subscribedClient = this.subscribedClients.get(client.id);
    if (subscribedClient) {
      subscribedClient.raceIds.delete(raceId);
    }

    this.logger.log(`Client ${client.id} unsubscribed from race ${raceId}`);

    return {
      event: "unsubscribe_race_response",
      data: {
        success: true,
        message: `Unsubscribed from race ${raceId}`,
        raceId,
      },
    };
  }

  /**
   * Broadcast a position update to all clients subscribed to the race
   */
  broadcastPositionUpdate(update: PositionUpdateDto): void {
    const roomName = `race:${update.raceId}`;

    this.server.to(roomName).emit("position_update", {
      participantId: update.participantId,
      raceId: update.raceId,
      latitude: update.latitude,
      longitude: update.longitude,
      timestamp: update.timestamp.toISOString(),
      status: update.status,
    });

    this.logger.debug(
      `Broadcasted position update for participant ${update.participantId} in race ${update.raceId}`,
    );
  }

  /**
   * Broadcast batch position updates to all clients subscribed to the race
   */
  broadcastBatchPositionUpdate(
    raceId: string,
    updates: PositionUpdateDto[],
  ): void {
    const roomName = `race:${raceId}`;

    this.server.to(roomName).emit("batch_position_update", {
      raceId,
      positions: updates.map((update) => ({
        participantId: update.participantId,
        latitude: update.latitude,
        longitude: update.longitude,
        timestamp: update.timestamp.toISOString(),
        status: update.status,
      })),
    });

    this.logger.debug(
      `Broadcasted batch position update for race ${raceId} with ${updates.length} positions`,
    );
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, event: string, data: unknown): void {
    this.server.to(clientId).emit(event, data);
  }

  /**
   * Get the number of clients subscribed to a race
   */
  async getRaceSubscriberCount(raceId: string): Promise<number> {
    const roomName = `race:${raceId}`;
    const sockets = await this.server.in(roomName).fetchSockets();
    return sockets.length;
  }

  /**
   * Get all race IDs that have at least one subscriber
   */
  getActiveRaces(): string[] {
    const activeRaces = new Set<string>();

    for (const client of this.subscribedClients.values()) {
      for (const raceId of client.raceIds) {
        activeRaces.add(raceId);
      }
    }

    return Array.from(activeRaces);
  }

  /**
   * Get total connected client count
   */
  getConnectedClientCount(): number {
    return this.subscribedClients.size;
  }
}
