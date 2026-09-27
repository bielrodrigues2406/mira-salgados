import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../common/auth/usuario-autenticado.js';
import { type HealthStatus, HealthService } from './health.service.js';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
