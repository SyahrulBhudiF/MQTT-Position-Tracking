import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type TrackingErrors, formatTrackingError } from '../../tracking/tracking.errors';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  details?: unknown;
}

/**
 * Global exception filter that handles all exceptions thrown in the application.
 * Provides consistent error response format across HTTP and WebSocket contexts.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const contextType = host.getType();

    if (contextType === 'http') {
      this.handleHttpException(exception, host);
    } else if (contextType === 'ws') {
      this.handleWsException(exception, host);
    } else {
      this.logger.error('Unhandled exception in unknown context', exception);
    }
  }

  /**
   * Handle exceptions in HTTP context
   */
  private handleHttpException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error, details } = this.extractErrorInfo(exception);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (details) {
      errorResponse.details = details;
    }

    this.logger.error(`HTTP Exception: ${status} - ${message}`, {
      path: request.url,
      method: request.method,
      error,
      details,
    });

    response.status(status).json(errorResponse);
  }

  /**
   * Handle exceptions in WebSocket context
   */
  private handleWsException(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient();
    const { message, error, details } = this.extractErrorInfo(exception);

    const errorPayload = {
      event: 'error',
      data: {
        message,
        error,
        timestamp: new Date().toISOString(),
        details,
      },
    };

    this.logger.error(`WebSocket Exception: ${message}`, {
      clientId: client?.id,
      error,
      details,
    });

    // Emit error to the client
    if (client && typeof client.emit === 'function') {
      client.emit('error', errorPayload);
    }
  }

  /**
   * Extract error information from various exception types
   */
  private extractErrorInfo(exception: unknown): {
    status: number;
    message: string;
    error: string;
    details?: unknown;
  } {
    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;
        return {
          status,
          message: (responseObj.message as string) || exception.message,
          error: (responseObj.error as string) || 'HttpException',
          details: responseObj.details,
        };
      }

      return {
        status,
        message: typeof response === 'string' ? response : exception.message,
        error: 'HttpException',
      };
    }

    // Handle Effect tracking errors
    if (this.isTrackingError(exception)) {
      return {
        status: this.getStatusFromTrackingError(exception),
        message: formatTrackingError(exception),
        error: exception._tag,
        details: this.getTrackingErrorDetails(exception),
      };
    }

    // Handle standard Error
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
        error: exception.name || 'Error',
        details: exception.stack,
      };
    }

    // Handle unknown exceptions
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'UnknownError',
      details: String(exception),
    };
  }

  /**
   * Check if the exception is a tracking error
   */
  private isTrackingError(exception: unknown): exception is TrackingErrors {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      '_tag' in exception &&
      typeof (exception as { _tag: unknown })._tag === 'string'
    );
  }

  /**
   * Get HTTP status code from tracking error type
   */
  private getStatusFromTrackingError(error: TrackingErrors): number {
    switch (error._tag) {
      case 'PayloadValidationError':
      case 'InvalidCoordinatesError':
      case 'TimestampParseError':
        return HttpStatus.BAD_REQUEST;
      case 'ParticipantNotFoundError':
      case 'RaceNotFoundError':
        return HttpStatus.NOT_FOUND;
      case 'StaleDataError':
        return HttpStatus.UNPROCESSABLE_ENTITY;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Extract additional details from tracking errors
   */
  private getTrackingErrorDetails(error: TrackingErrors): Record<string, unknown> | undefined {
    switch (error._tag) {
      case 'PayloadValidationError':
        return {
          validationErrors: error.validationErrors,
          payload: error.payload,
        };
      case 'StaleDataError':
        return {
          participantId: error.participantId,
          raceId: error.raceId,
          dataTimestamp: error.dataTimestamp.toISOString(),
          threshold: error.threshold,
        };
      case 'InvalidCoordinatesError':
        return {
          latitude: error.latitude,
          longitude: error.longitude,
        };
      case 'ParticipantNotFoundError':
        return {
          participantId: error.participantId,
          raceId: error.raceId,
        };
      case 'RaceNotFoundError':
        return {
          raceId: error.raceId,
        };
      case 'StorageError':
        return {
          operation: error.operation,
        };
      default:
        return undefined;
    }
  }
}
