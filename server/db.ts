import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.JORNADA_DATABASE_URL }),
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
