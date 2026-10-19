import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { DatabaseModule } from './db/database.module';
import {
  AuthController,
  CurrentUserController,
  MatchController,
  TournamentController,
} from './features/controllers';
import { AuthGuard, RolesGuard } from './features/guards';
import { TournamentService } from './features/tournament.service';
import { GameGateway } from './features/game.gateway';
import { AuthService } from './features/auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string()
          .uri({ scheme: ['postgres', 'postgresql'] })
          .required(),
        JWT_SECRET: Joi.string().min(32).required(),
        API_PORT: Joi.number().port().default(3000),
        FRONTEND_URL: Joi.string().uri().default('http://localhost:3001'),
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    DatabaseModule,
  ],
  controllers: [
    AppController,
    AuthController,
    CurrentUserController,
    TournamentController,
    MatchController,
  ],
  providers: [
    AuthService,
    TournamentService,
    AuthGuard,
    RolesGuard,
    GameGateway,
  ],
})
export class AppModule {}
