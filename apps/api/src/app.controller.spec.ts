import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { DatabaseService } from './db/database.service';

describe('AppController', () => {
  let appController: AppController;
  const database = { checkConnection: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: DatabaseService, useValue: database }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('checks the database and reports a healthy API', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        success: true,
        data: { status: 'ok', database: 'ok' },
      });
      expect(database.checkConnection).toHaveBeenCalledTimes(1);
    });
  });
});
