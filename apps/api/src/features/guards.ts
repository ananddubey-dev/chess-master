import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { users } from '../db/schema';

type UserRole = 'COACH' | 'STUDENT';
export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type AuthenticatedRequest = Request & { user: AuthenticatedUser };
const ROLE_KEY = 'required-roles';

export const Roles = (...roles: AuthenticatedUser['role'][]) =>
  SetMetadata(ROLE_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.kc_session as string | undefined;
    if (!token) throw new UnauthorizedException('Authentication required');

    let claims: { sub?: string };
    try {
      claims = await this.jwt.verifyAsync<{ sub?: string }>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
    if (!claims.sub) throw new UnauthorizedException('Invalid session');

    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, claims.sub))
      .limit(1);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    request.user = user;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      AuthenticatedUser['role'][]
    >(ROLE_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user || !required.includes(request.user.role)) {
      throw new ForbiddenException(
        'This action is not permitted for your role',
      );
    }
    return true;
  }
}
