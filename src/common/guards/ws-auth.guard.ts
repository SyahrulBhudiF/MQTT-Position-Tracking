import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import type { Socket } from 'socket.io';

/**
 * WebSocket Authentication Guard
 *
 * This guard validates WebSocket connections and messages.
 * In production, implement proper JWT or token-based authentication.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();

    try {
      // Extract token from handshake auth or query
      const token = this.extractToken(client);

      if (!token) {
        // In development mode, allow connections without token
        // In production, you should return false here
        this.logger.warn(`Client ${client.id} connected without authentication token`);
        return true; // Change to false in production
      }

      // Validate the token
      const isValid = this.validateToken(token);

      if (!isValid) {
        this.logger.warn(`Client ${client.id} provided invalid token`);
        return false;
      }

      this.logger.debug(`Client ${client.id} authenticated successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Authentication error for client ${client.id}`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * Extract authentication token from socket connection
   */
  private extractToken(client: Socket): string | null {
    // Try to get token from handshake auth
    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    // Try to get token from handshake headers
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      // Handle Bearer token format
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
      }
      return authHeader;
    }

    // Try to get token from query parameters
    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  /**
   * Validate the authentication token
   *
   * TODO: Implement proper JWT validation in production
   */
  private validateToken(token: string): boolean {
    // Placeholder validation - implement proper JWT validation
    // Example with JWT:
    // try {
    //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //   return !!decoded;
    // } catch {
    //   return false;
    // }

    // For now, accept any non-empty token in development
    return token.length > 0;
  }
}
