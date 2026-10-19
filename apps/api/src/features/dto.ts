import {
  IsNotEmpty,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Length,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { Square } from 'chess.js';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class CreateTournamentDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(3, 80)
  @IsNotEmpty()
  name!: string;

  @IsISO8601()
  startsAt!: string;

  @IsInt()
  @Min(60)
  @Max(7200)
  baseTimeSecs!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  incrementSecs?: number;
}

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(3, 80)
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(7200)
  baseTimeSecs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  incrementSecs?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'ONGOING', 'COMPLETED'])
  status?: 'DRAFT' | 'OPEN' | 'ONGOING' | 'COMPLETED';
}

export class IdParamDto {
  @IsUUID()
  id!: string;
}

export class MoveDto {
  @IsUUID()
  matchId!: string;

  @IsString()
  @Length(32, 128)
  expectedFen!: string;

  @IsString()
  @Matches(/^[a-h][1-8]$/)
  from!: Square;

  @IsString()
  @Matches(/^[a-h][1-8]$/)
  to!: Square;

  @IsOptional()
  @IsIn(['q', 'r', 'b', 'n'])
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export class MatchIdDto {
  @IsUUID()
  matchId!: string;
}

export class TournamentQueueDto {
  @IsUUID()
  tournamentId!: string;
}

export class CancelQueueDto {
  @IsUUID()
  tournamentId!: string;
}

export class ResignDto {
  @IsUUID()
  matchId!: string;
}
