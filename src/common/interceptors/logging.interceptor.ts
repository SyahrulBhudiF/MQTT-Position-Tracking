import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

/**
 * Logging interceptor that logs incoming requests and outgoing responses.
 * Captures request details, response status, and execution time.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const contextType = context.getType();

    if (contextType === 'http') {
      return this.handleHttpContext(context, next);
    }

    if (contextType === 'ws') {
      return this.handleWsContext(context, next);
    }

    return next.handle();
  }

  /**
   * Handle logging for HTTP requests
   */
  private handleHttpContext(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const correlationId = (headers['x-correlation-id'] as string) || this.generateCorrelationId();

    const startTime = Date.now();

    this.logger.log(`[${correlationId}] Incoming ${method} ${url}`, {
      ip,
      userAgent,
      correlationId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.log(
            `[${correlationId}] Completed ${method} ${url} ${statusCode} - ${duration}ms`,
            {
              statusCode,
              duration,
              correlationId,
            },
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;

          this.logger.error(`[${correlationId}] Failed ${method} ${url} - ${duration}ms`, {
            error: error.message,
            duration,
            correlationId,
          });
        },
      }),
    );
  }

  /**
   * Handle logging for WebSocket messages
   */
  private handleWsContext(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();
    const pattern = context.getHandler().name;

    const clientId = client?.id || 'unknown';
    const startTime = Date.now();

    this.logger.log(`[WS:${clientId}] Received message: ${pattern}`, {
      clientId,
      pattern,
      dataSize: JSON.stringify(data).length,
    });

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;

          this.logger.log(`[WS:${clientId}] Processed ${pattern} - ${duration}ms`, {
            clientId,
            pattern,
            duration,
            hasResponse: !!response,
          });
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;

          this.logger.error(`[WS:${clientId}] Failed ${pattern} - ${duration}ms`, {
            clientId,
            pattern,
            error: error.message,
            duration,
          });
        },
      }),
    );
  }

  /**
   * Generate a unique correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${randomPart}`;
  }
}
