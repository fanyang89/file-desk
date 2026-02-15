import { PrismaClient } from "@prisma/client";
import path from "path";

declare global {
	var __fileDeskPrisma: PrismaClient | undefined;
}

const databaseUrl =
	process.env.DATABASE_URL ??
	`file:${path.resolve(process.cwd(), ".data", "file-desk.db")}`;

if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL = databaseUrl;
}

export const prisma =
	globalThis.__fileDeskPrisma ??
	new PrismaClient({
		datasources: {
			db: {
				url: databaseUrl,
			},
		},
	});

if (process.env.NODE_ENV !== "production") {
	globalThis.__fileDeskPrisma = prisma;
}
