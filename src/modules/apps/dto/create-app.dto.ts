import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Create App DTO Schema
 * 
 * Uses Zod for runtime validation and type inference.
 * Validates app (tenant) creation data before it reaches the service layer.
 * 
 * Validation Rules:
 * - name: Minimum 3 characters, required string
 * - slug: Minimum 3 characters, slug-friendly format (lowercase, alphanumeric, hyphens only)
 * 
 * Why validate slug format?
 * - URLs: Slugs are used in URLs and must be URL-safe
 * - Consistency: Enforces a standard format across all apps
 * - SEO: Clean, readable slugs improve user experience
 */
export const createAppSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'App name must be at least 3 characters' })
    .max(255, { message: 'App name is too long' })
    .trim(),
  slug: z
    .string()
    .min(3, { message: 'App slug must be at least 3 characters' })
    .max(255, { message: 'App slug is too long' })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'App slug must contain only lowercase letters, numbers, and hyphens. Must start and end with alphanumeric characters.',
    })
    .toLowerCase() // Normalize slug to lowercase for consistency
    .trim(),
});

/**
 * Create App DTO
 * 
 * Generated DTO class from Zod schema using nestjs-zod.
 * This provides:
 * - Runtime validation via class-validator-like decorators
 * - TypeScript type inference
 * - Automatic Swagger documentation (if configured)
 */
export class CreateAppDto extends createZodDto(createAppSchema) {}
