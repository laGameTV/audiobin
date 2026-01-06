import { writeFile, unlink, mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { CronJob } from "cron";

const UPLOAD_DIR = join(process.cwd(), "uploads");

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

// Parse filename to extract expiry timestamp
function parseFilename(filename: string): { id: string; expiresAt: Date; ext: string } | null {
	const match = filename.match(/^([a-f0-9]{16})([a-f0-9]{8})\.(.+)$/);
	if (!match) return null;

	const [, id, expiryHex, ext] = match;
	const expiryTimestamp = parseInt(expiryHex, 16);
	const expiresAt = new Date(expiryTimestamp * 1000);

	return { id, expiresAt, ext };
}

// Load existing files from disk on startup
export async function loadExistingFiles() {
	try {
		const files = await readdir(UPLOAD_DIR);

		for (const filename of files) {
			const parsed = parseFilename(filename);
			if (!parsed) continue;

			const { id, expiresAt } = parsed;
			const path = join(UPLOAD_DIR, filename);

			// Skip if already expired
			if (expiresAt < new Date()) {
				try {
					await unlink(path);
					console.log(`Deleted expired file on startup: ${filename}`);
				} catch {}
				continue;
			}

			// Restore to storage
			const file: StoredFile = {
				id,
				filename: filename, // We don't have original filename, use stored one
				path,
				mimeType: "application/octet-stream", // Unknown after restart
				size: 0, // Unknown after restart
				expiresAt,
			};

			storage.set(id, file);
		}

		console.log(`Loaded ${storage.size} existing file(s) from disk`);
	} catch (err) {
		console.error("Failed to load existing files:", err);
	}
}

// Cleanup function to delete expired files
async function cleanupExpiredFiles() {
	const now = new Date();

	for (const [id, file] of storage.entries()) {
		if (file.expiresAt < now) {
			try {
				await unlink(file.path);
				storage.delete(id);
				console.log(`[CLEANUP] Deleted expired file:`, {
					id,
					filename: file.filename,
					expiredAt: file.expiresAt.toISOString(),
				});
			} catch (err) {
				console.error(`[CLEANUP] Failed to delete file ${id}:`, err);
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
	const id = randomBytes(8).toString("hex");
	const ext = filename.split(".").pop() || "bin";

	const expiresAt = new Date();
	expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour from now

	// Encode expiry timestamp as hex (last 8 chars before extension)
	const expiryHex = Math.floor(expiresAt.getTime() / 1000)
		.toString(16)
		.padStart(8, "0");
	const storedFilename = `${id}${expiryHex}.${ext}`;
	const path = join(UPLOAD_DIR, storedFilename);

	await writeFile(path, buffer);

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
