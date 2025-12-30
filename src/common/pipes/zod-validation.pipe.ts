import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodError, ZodSchema } from 'zod';

/**
 * Custom validation pipe that uses Zod schemas for validation.
 * This pipe can be used to validate incoming data against Zod schemas.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = this.formatZodErrors(result.error);
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }

    return result.data;
  }

  /**
   * Format Zod validation errors into a readable format
   */
  private formatZodErrors(error: ZodError): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    for (const issue of error.issues) {
      const path = issue.path.join('.') || 'value';
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(issue.message);
    }

    return errors;
  }
}

/**
 * Factory function to create a ZodValidationPipe for a specific schema
 */
export const createZodValidationPipe = (schema: ZodSchema): ZodValidationPipe => {
  return new ZodValidationPipe(schema);
};

/**
 * Generic validation pipe that validates if a value is defined
 */
@Injectable()
export class RequiredPipe implements PipeTransform {
  constructor(private readonly fieldName: string = 'value') {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${this.fieldName} is required`);
    }
    return value;
  }
}

/**
 * Pipe to validate that a string is a valid UUID
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform {
  private readonly uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  transform(value: unknown, _metadata: ArgumentMetadata): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('UUID must be a string');
    }

    if (!this.uuidRegex.test(value)) {
      throw new BadRequestException('Invalid UUID format');
    }

    return value;
  }
}

/**
 * Pipe to parse and validate integer values
 */
@Injectable()
export class ParseIntPipe implements PipeTransform {
  constructor(
    private readonly options?: {
      min?: number;
      max?: number;
      optional?: boolean;
    },
  ) {}

  transform(value: unknown, _metadata: ArgumentMetadata): number | undefined {
    if (value === undefined || value === null || value === '') {
      if (this.options?.optional) {
        return undefined;
      }
      throw new BadRequestException('Value is required');
    }

    const parsed = Number.parseInt(String(value), 10);

    if (Number.isNaN(parsed)) {
      throw new BadRequestException('Value must be a valid integer');
    }

    if (this.options?.min !== undefined && parsed < this.options.min) {
      throw new BadRequestException(`Value must be at least ${this.options.min}`);
    }

    if (this.options?.max !== undefined && parsed > this.options.max) {
      throw new BadRequestException(`Value must be at most ${this.options.max}`);
    }

    return parsed;
  }
}

/**
 * Pipe to trim and sanitize string values
 */
@Injectable()
export class TrimStringPipe implements PipeTransform {
  constructor(
    private readonly options?: {
      toLowerCase?: boolean;
      toUpperCase?: boolean;
      maxLength?: number;
    },
  ) {}

  transform(value: unknown, _metadata: ArgumentMetadata): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Value must be a string');
    }

    let result = value.trim();

    if (this.options?.toLowerCase) {
      result = result.toLowerCase();
    }

    if (this.options?.toUpperCase) {
      result = result.toUpperCase();
    }

    if (this.options?.maxLength && result.length > this.options.maxLength) {
      result = result.substring(0, this.options.maxLength);
    }

    return result;
  }
}
