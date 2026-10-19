import {
  HttpException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { DefaultEventsMap, Socket, Server } from 'socket.io';
import { TournamentService } from './tournament.service';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './guards';
import { MatchIdDto, MoveDto, ResignDto, TournamentQueueDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

type GameSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { user?: AuthenticatedUser }
>;

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(
        null,
        !origin ||
          origin === (process.env.FRONTEND_URL ?? 'http://localhost:3001'),
      );
    },
    credentials: true,
  },
})
export class GameGateway
  implements OnGatewayConnection<GameSocket>, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;

  private timeoutInterval: NodeJS.Timeout | undefined;
  private processingTimeouts = false;
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly service: TournamentService,
  ) {}

  onModuleInit(): void {
    this.timeoutInterval = setInterval(() => {
      if (this.processingTimeouts) return;
      this.processingTimeouts = true;
      void this.service
        .expireActiveMatches()
        .then(async (expired) => {
          for (const match of expired) {
            const whiteState = await this.service.getMatchSnapshot(
              match.id,
              match.whitePlayerId,
            );
            const blackState = await this.service.getMatchSnapshot(
              match.id,
              match.blackPlayerId,
            );
            this.server
              .to(userRoom(match.whitePlayerId))
              .emit('match:finished', whiteState);
            this.server
              .to(userRoom(match.blackPlayerId))
              .emit('match:finished', blackState);
          }
        })
        .catch((error: unknown) => {
          this.logger.error('Unable to process active match clocks', error);
        })
        .finally(() => {
          this.processingTimeouts = false;
        });
    }, 3000);
  }

  onModuleDestroy(): void {
    if (this.timeoutInterval) clearInterval(this.timeoutInterval);
  }

  async handleConnection(client: GameSocket): Promise<void> {
    const token = cookieValue(client.handshake.headers.cookie, 'kc_session');
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const claims = await this.jwt.verifyAsync<{ sub?: string }>(token);
      if (!claims.sub) throw new WsException('Invalid session');
      const user = await this.auth.getUser(claims.sub);
      if (!user) {
        client.disconnect(true);
        return;
      }
      client.data.user = user;
      await client.join(userRoom(user.id));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('queue:join')
  async queueJoin(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: unknown,
  ): Promise<Record<string, unknown>> {
    try {
      const user = this.requireUser(client);
      if (user.role !== 'STUDENT')
        throw new WsException('Only students can queue');
      const request = validatePayload(TournamentQueueDto, payload);
      const result = await this.service.queueStudent(
        user,
        request.tournamentId,
      );
      if (result.status === 'WAITING') {
        client.emit('queue:waiting', { tournamentId: request.tournamentId });
      } else if (result.matchId) {
        const match = {
          tournamentId: request.tournamentId,
          matchId: result.matchId,
        };
        const snapshot = await this.service.getMatchSnapshot(
          result.matchId,
          user.id,
        );
        const white = snapshot.white as { id: string } | undefined;
        const black = snapshot.black as { id: string } | undefined;
        if (white && black) {
          this.server.to(userRoom(white.id)).emit('queue:matched', match);
          this.server.to(userRoom(black.id)).emit('queue:matched', match);
        }
      }
      return { success: true, data: result };
    } catch (error) {
      return this.reportError(client, error);
    }
  }

  @SubscribeMessage('queue:cancel')
  async queueCancel(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: unknown,
  ): Promise<Record<string, unknown>> {
    try {
      const user = this.requireUser(client);
      const request = validatePayload(TournamentQueueDto, payload);
      const data = await this.service.cancelQueue(
        user.id,
        request.tournamentId,
      );
      return { success: true, data };
    } catch (error) {
      return this.reportError(client, error);
    }
  }

  @SubscribeMessage('match:join')
  async matchJoin(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: unknown,
  ): Promise<Record<string, unknown>> {
    try {
      const user = this.requireUser(client);
      const request = validatePayload(MatchIdDto, payload);
      await this.service.getMatchSnapshot(request.matchId, user.id);
      await client.join(matchRoom(request.matchId));
      const state = await this.service.getMatchSnapshot(
        request.matchId,
        user.id,
      );
      client.emit('match:state', state);
      if (state.status === 'COMPLETED' && state.endReason === 'TIMEOUT') {
        await this.broadcastMatchState(
          request.matchId,
          user.id,
          'match:finished',
        );
      }
      return { success: true, data: state };
    } catch (error) {
      return this.reportError(client, error);
    }
  }

  @SubscribeMessage('match:move')
  async matchMove(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: unknown,
  ): Promise<Record<string, unknown>> {
    try {
      const user = this.requireUser(client);
      const request = validatePayload(MoveDto, payload);
      const state = await this.service.submitMove(user.id, request);
      const event =
        state.status === 'COMPLETED' ? 'match:finished' : 'match:move:accepted';
      await this.broadcastMatchState(request.matchId, user.id, event);
      return { success: true, data: state };
    } catch (error) {
      return this.reportError(client, error);
    }
  }

  @SubscribeMessage('match:resign')
  async matchResign(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: unknown,
  ): Promise<Record<string, unknown>> {
    try {
      const user = this.requireUser(client);
      const request = validatePayload(ResignDto, payload);
      const state = await this.service.resign(user.id, request.matchId);
      await this.broadcastMatchState(
        request.matchId,
        user.id,
        'match:finished',
      );
      return { success: true, data: state };
    } catch (error) {
      return this.reportError(client, error);
    }
  }

  private requireUser(client: GameSocket): AuthenticatedUser {
    if (!client.data.user) throw new WsException('Authentication required');
    return client.data.user;
  }

  private reportError(
    client: GameSocket,
    error: unknown,
  ): Record<string, unknown> {
    const expected =
      error instanceof HttpException || error instanceof WsException;
    const message = expected ? error.message : 'Unexpected request error';
    if (!expected) this.logger.error('Unhandled socket request error', error);
    const response = {
      success: false,
      error: { code: 'SOCKET_REQUEST_FAILED', message },
    };
    client.emit('match:error', response.error);
    if (expected) {
      this.logger.warn(`Socket request rejected: ${message}`);
    }
    return response;
  }

  private async broadcastMatchState(
    matchId: string,
    anchorUserId: string,
    event: 'match:move:accepted' | 'match:finished',
  ): Promise<void> {
    const base = await this.service.getMatchSnapshot(matchId, anchorUserId);
    const white = base.white as { id: string } | undefined;
    const black = base.black as { id: string } | undefined;
    if (!white || !black) return;
    const whiteState = await this.service.getMatchSnapshot(matchId, white.id);
    const blackState = await this.service.getMatchSnapshot(matchId, black.id);
    this.server.to(userRoom(white.id)).emit(event, whiteState);
    this.server.to(userRoom(black.id)).emit(event, blackState);
  }
}

function validatePayload<T extends object>(
  type: new () => T,
  payload: unknown,
): T {
  const instance = plainToInstance(type, payload);
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new WsException(messages.join(', ') || 'Invalid socket payload');
  }
  return instance;
}

function cookieValue(
  header: string | undefined,
  name: string,
): string | undefined {
  const entry = header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return undefined;
  return decodeURIComponent(entry.slice(name.length + 1));
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}
