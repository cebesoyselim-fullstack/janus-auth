import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Login DTO Schema
 * 
 * Validates login request data.
 * Requires email, password, and app_id for multi-tenant authentication.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email({ message: 'Invalid email format' })
    .toLowerCase()
    .trim(),
  password: z.string().min(1, { message: 'Password is required' }),
  app_id: z.string().uuid({ message: 'app_id must be a valid UUID' }),
});

export class LoginDto extends createZodDto(loginSchema) {}


