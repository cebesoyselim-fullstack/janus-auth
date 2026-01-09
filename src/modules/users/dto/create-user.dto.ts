import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Create User DTO Schema
 * 
 * Uses Zod for runtime validation and type inference.
 * This ensures data integrity at the API boundary before
 * it reaches the service layer.
 * 
 * Validation Rules:
 * - email: Must be a valid email format
 * - password: Minimum 6 characters (bcrypt requirement)
 * - app_id: Must be a valid UUID v4 format
 */
export const createUserSchema = z.object({
  email: z
    .string()
    .email({ message: 'Invalid email format' })
    .toLowerCase() // Normalize email to lowercase for consistency
    .trim(),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(255, { message: 'Password is too long' }),
  app_id: z
    .string()
    .uuid({ message: 'app_id must be a valid UUID' }),
});

/**
 * Create User DTO
 * 
 * Generated DTO class from Zod schema using nestjs-zod.
 * This provides:
 * - Runtime validation via class-validator-like decorators
 * - TypeScript type inference
 * - Automatic Swagger documentation (if configured)
 */
export class CreateUserDto extends createZodDto(createUserSchema) {}


