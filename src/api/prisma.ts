import { PrismaClient } from "@prisma/client";

declare global {
	var __fileDeskPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__fileDeskPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.__fileDeskPrisma = prisma;
}
