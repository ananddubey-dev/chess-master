import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service';
import { users } from '../db/schema';
import type { AuthenticatedUser } from './guards';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthenticatedUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    const [record] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (!record || !(await compare(password, record.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    const user: AuthenticatedUser = {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
    };
    const token = await this.jwt.signAsync({ sub: user.id });
    return { token, user };
  }

  async getUser(id: string): Promise<AuthenticatedUser | null> {
    const [record] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return record ?? null;
  }
}
