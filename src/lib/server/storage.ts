import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { CronJob } from "cron";

const UPLOAD_DIR = join(process.cwd(), "uploads");
const CLEANUP_INTERVAL = 60 * 1000; // Check every minute

interface StoredFile {
	id: string;
	filename: string;
	path: string;
	mimeType: string;
	size: number;
	expiresAt: Date;
}

const storage = new Map<string, StoredFile>();

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
	await mkdir(UPLOAD_DIR, { recursive: true });
}

// Cleanup function to delete expired files
async function cleanupExpiredFiles() {
	const now = new Date();

	for (const [id, file] of storage.entries()) {
		if (file.expiresAt < now) {
			try {
				await unlink(file.path);
				storage.delete(id);
				console.log(`Deleted expired file: ${id}`);
			} catch (err) {
				console.error(`Failed to delete file ${id}:`, err);
			}
		}
	}
}

let cleanupJob: CronJob | null = null;

// Start cleanup cronjob
export function startCleanupJob() {
	if (cleanupJob) {
		console.log("Cleanup job already running");
		return;
	}

	// Run cleanup immediately on start
	cleanupExpiredFiles();

	// Cron pattern: every minute
	cleanupJob = new CronJob("* * * * *", cleanupExpiredFiles);
	cleanupJob.start();
	console.log("File cleanup cronjob started (runs every minute)");
}

// Stop cleanup cronjob (useful for testing)
export function stopCleanupJob() {
	if (cleanupJob) {
		cleanupJob.stop();
		cleanupJob = null;
		console.log("File cleanup cronjob stopped");
	}
}

export async function storeFile(buffer: Buffer, filename: string, mimeType: string): Promise<StoredFile> {
	const id = randomBytes(16).toString("hex");
	const ext = filename.split(".").pop() || "bin";
	const storedFilename = `${id}.${ext}`;
	const path = join(UPLOAD_DIR, storedFilename);

	await writeFile(path, buffer);

	const expiresAt = new Date();
	expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour from now

	const file: StoredFile = {
		id,
		filename,
		path,
		mimeType,
		size: buffer.length,
		expiresAt,
	};

	storage.set(id, file);

	return file;
}

export function getFile(id: string): StoredFile | undefined {
	const file = storage.get(id);

	if (!file) return undefined;

	// Check if expired
	if (file.expiresAt < new Date()) {
		storage.delete(id);
		unlink(file.path).catch(() => {});
		return undefined;
	}

	return file;
}

export async function deleteFile(id: string): Promise<boolean> {
	const file = storage.get(id);

	if (!file) return false;

	try {
		await unlink(file.path);
		storage.delete(id);
		return true;
	} catch {
		return false;
	}
}
