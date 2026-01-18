import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';

/**
 * Apps Controller
 * 
 * Handles HTTP requests related to app (tenant) management.
 * 
 * Why are these endpoints public?
 * - GET /apps: Frontend needs to display "Select App" dropdown before login
 * - POST /apps: For this phase, left public for easy app creation during testing
 *   (Can be protected later based on business requirements)
 * 
 * Why separate controller from service?
 * - HTTP-specific concerns (status codes, request/response)
 * - Route definitions and decorators
 * - Request validation (handled by DTOs)
 */
@ApiTags('Apps')
@Controller('apps')
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  /**
   * Create a new app (tenant)
   * 
   * Route: POST /apps
   * 
   * Creates a new tenant application.
   * Handles unique slug constraint errors gracefully.
   * 
   * @param createAppDto - App creation data (name, slug)
   * @returns Created app with ID, name, slug, and timestamps
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new app (tenant)' })
  @ApiResponse({
    status: 201,
    description: 'App created successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Tracking App',
        slug: 'tracking-app',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'App with this slug already exists',
  })
  async create(@Body() createAppDto: CreateAppDto) {
    return this.appsService.create(createAppDto);
  }

  /**
   * List all active apps
   * 
   * Route: GET /apps
   * 
   * Returns all active (non-deleted) apps.
   * This endpoint is public so frontend can show "Select App" dropdown
   * before user authentication.
   * 
   * @returns Array of active apps (excludes soft-deleted apps)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all active apps (tenants)' })
  @ApiResponse({
    status: 200,
    description: 'List of active apps',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Tracking App',
          slug: 'tracking-app',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          name: 'Todo App',
          slug: 'todo-app',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  async findAll() {
    return this.appsService.findAll();
  }
}
