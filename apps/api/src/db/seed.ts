import { config as loadEnv } from 'dotenv';
import { hash } from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import * as schema from './schema';
import { users } from './schema';

loadEnv({ path: '../../.env' });
loadEnv();

async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required to seed the database');
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const coachPasswordHash = await hash('Coach123!', 12);
  const studentPasswordHash = await hash('Student123!', 12);
  const seedUsers = [
    {
      email: 'coach@kingdomchess.local',
      name: 'Coach Mira',
      role: 'COACH' as const,
      passwordHash: coachPasswordHash,
    },
    ...['Aarav', 'Anaya', 'Kabir', 'Isha'].map((name) => ({
      email: `${name.toLowerCase()}@kingdomchess.local`,
      name,
      role: 'STUDENT' as const,
      passwordHash: studentPasswordHash,
    })),
  ];
  try {
    for (const user of seedUsers) {
      await db
        .insert(users)
        .values({ ...user, id: randomUUID() })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: user.name,
            role: user.role,
            passwordHash: user.passwordHash,
            updatedAt: new Date(),
          },
        });
    }
    console.info(`Seeded ${seedUsers.length} local assessment accounts.`);
  } finally {
    await pool.end();
  }
}

void seed().catch((error: unknown) => {
  console.error('Database seed failed', error);
  process.exitCode = 1;
});
