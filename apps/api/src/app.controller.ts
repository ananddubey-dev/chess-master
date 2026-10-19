import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './db/database.service';

@Controller('health')
export class AppController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async getHealth(): Promise<{
    success: true;
    data: { status: 'ok'; database: 'ok' };
  }> {
    await this.database.checkConnection();
    return { success: true, data: { status: 'ok', database: 'ok' } };
  }
}
