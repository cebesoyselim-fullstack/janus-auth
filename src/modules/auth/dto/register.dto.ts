import { createZodDto } from 'nestjs-zod';
import { createUserSchema } from '../../users/dto/create-user.dto';

/**
 * Register DTO
 * 
 * Reuses the CreateUserDto schema since registration
 * requires the same fields as user creation.
 * This ensures consistency across the application.
 */
export class RegisterDto extends createZodDto(createUserSchema) {}


