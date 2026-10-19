import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  CreateTournamentDto,
  IdParamDto,
  LoginDto,
  MoveDto,
  UpdateTournamentDto,
} from './dto';
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthenticatedUser,
} from './guards';
import { TournamentService } from './tournament.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true; data: AuthenticatedUser }> {
    const { token, user } = await this.auth.login(input.email, input.password);
    response.cookie('kc_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { success: true, data: user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): {
    success: true;
    data: { loggedOut: true };
  } {
    response.clearCookie('kc_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { success: true, data: { loggedOut: true } };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): {
    success: true;
    data: AuthenticatedUser;
  } {
    return { success: true, data: user };
  }
}

@Controller()
@UseGuards(AuthGuard)
export class CurrentUserController {
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): {
    success: true;
    data: AuthenticatedUser;
  } {
    return { success: true, data: user };
  }
}

@Controller('tournaments')
@UseGuards(AuthGuard, RolesGuard)
export class TournamentController {
  constructor(private readonly service: TournamentService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: Record<string, unknown>[] }> {
    return {
      success: true,
      data: await this.service.listTournaments(user.id),
    };
  }

  @Get(':id')
  async get(
    @Param() { id }: IdParamDto,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    return { success: true, data: await this.service.getTournament(id) };
  }

  @Post()
  @Roles('COACH')
  async create(
    @CurrentUser() coach: AuthenticatedUser,
    @Body() input: CreateTournamentDto,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    return {
      success: true,
      data: await this.service.createTournament(coach, input),
    };
  }

  @Patch(':id')
  @Roles('COACH')
  async update(
    @CurrentUser() coach: AuthenticatedUser,
    @Param() { id }: IdParamDto,
    @Body() input: UpdateTournamentDto,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    return {
      success: true,
      data: await this.service.updateTournament(coach, id, input),
    };
  }

  @Delete(':id')
  @Roles('COACH')
  async delete(
    @CurrentUser() coach: AuthenticatedUser,
    @Param() { id }: IdParamDto,
  ): Promise<{ success: true; data: { deleted: true } }> {
    await this.service.deleteTournament(coach, id);
    return { success: true, data: { deleted: true } };
  }

  @Post(':id/join')
  @Roles('STUDENT')
  async join(
    @CurrentUser() student: AuthenticatedUser,
    @Param() { id }: IdParamDto,
  ): Promise<{ success: true; data: { joined: true; tournamentId: string } }> {
    return {
      success: true,
      data: await this.service.joinTournament(student, id),
    };
  }

  @Get(':id/leaderboard')
  async leaderboard(
    @Param() { id }: IdParamDto,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    return { success: true, data: await this.service.getLeaderboard(id) };
  }

  @Get(':id/matches')
  async matches(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { id }: IdParamDto,
  ): Promise<{ success: true; data: Record<string, unknown>[] }> {
    return {
      success: true,
      data: await this.service.getTournamentMatches(user, id),
    };
  }
}

@Controller('matches')
@UseGuards(AuthGuard)
export class MatchController {
  constructor(private readonly service: TournamentService) {}

  @Get('mine')
  async mine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; data: Record<string, unknown>[] }> {
    return {
      success: true,
      data:
        user.role === 'COACH'
          ? await this.service.getCoachMatches(user.id)
          : await this.service.getMyMatches(user.id),
    };
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { id }: IdParamDto,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    return {
      success: true,
      data: await this.service.getMatchSnapshot(id, user.id),
    };
  }

  @Post(':id/resign')
  async resign(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { id }: IdParamDto,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    return { success: true, data: await this.service.resign(user.id, id) };
  }

  @Post(':id/move')
  async move(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { id }: IdParamDto,
    @Body() input: MoveDto,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    if (input.matchId !== id) {
      throw new BadRequestException(
        'The match ID in the body must match the URL',
      );
    }
    return {
      success: true,
      data: await this.service.submitMove(user.id, input),
    };
  }
}
