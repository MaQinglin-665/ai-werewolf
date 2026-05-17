import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl?.startsWith("file:")) {
  process.stdout.write("Skipped SQLite Prisma schema initialization: DATABASE_URL is not a file: URL.\n");
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe(`
    create table if not exists "Game" (
      "id" text not null primary key,
      "humanSeatId" integer,
      "status" text not null,
      "phase" text not null,
      "day" integer not null,
      "stateJson" text not null,
      "createdAt" datetime not null default current_timestamp,
      "updatedAt" datetime not null
    )
  `);
  await prisma.$executeRawUnsafe(`
    create table if not exists "Seat" (
      "id" text not null primary key,
      "gameId" text not null,
      "seatNumber" integer not null,
      "name" text not null,
      "isAi" boolean not null,
      "role" text not null,
      "isAlive" boolean not null,
      constraint "Seat_gameId_fkey" foreign key ("gameId") references "Game" ("id") on delete cascade on update cascade
    )
  `);
  await prisma.$executeRawUnsafe(`create unique index if not exists "Seat_gameId_seatNumber_key" on "Seat"("gameId", "seatNumber")`);
  await prisma.$executeRawUnsafe(`
    create table if not exists "GameEvent" (
      "id" text not null primary key,
      "gameId" text not null,
      "seq" integer not null,
      "type" text not null,
      "visibility" text not null,
      "actorSeatId" integer,
      "payloadJson" text not null,
      "createdAt" datetime not null default current_timestamp,
      constraint "GameEvent_gameId_fkey" foreign key ("gameId") references "Game" ("id") on delete cascade on update cascade
    )
  `);
  await prisma.$executeRawUnsafe(`create unique index if not exists "GameEvent_gameId_seq_key" on "GameEvent"("gameId", "seq")`);
  await prisma.$executeRawUnsafe(`
    create table if not exists "AiCallLog" (
      "id" text not null primary key,
      "gameId" text not null,
      "seatNumber" integer not null,
      "phase" text not null,
      "promptJson" text not null,
      "outputJson" text not null,
      "isFallback" boolean not null default false,
      "createdAt" datetime not null default current_timestamp,
      constraint "AiCallLog_gameId_fkey" foreign key ("gameId") references "Game" ("id") on delete cascade on update cascade
    )
  `);
  process.stdout.write("SQLite Prisma schema is ready.\n");
} finally {
  await prisma.$disconnect();
}
