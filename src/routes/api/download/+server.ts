import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { storeFile } from "$lib/server/storage";
import { unlink, readFile, stat, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { z } from "zod";
import { YtDlp } from "ytdlp-nodejs";

const downloadSchema = z.object({
	url: z.url("Ungültige URL"),
});

const TEMP_DIR = join(process.cwd(), "temp");

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
	await mkdir(TEMP_DIR, { recursive: true });
}

export const POST: RequestHandler = async ({ request, url }) => {
	let downloadedPath: string | null = null;

	try {
		const body = await request.json();

		// Validate with Zod
		const result = downloadSchema.safeParse(body);
		if (!result.success) {
			return json({ error: result.error.issues[0].message }, { status: 400 });
		}

		const { url: videoUrl } = result.data;

		// Get video info first to check duration
		try {
			const binaryPath = process.env.YTDLP_BINARY || "yt-dlp";
			const ytdlpInfo = new YtDlp({ binaryPath });
			const info = await ytdlpInfo.getInfoAsync(videoUrl);

			// Type guard to ensure we have a VideoInfo, not PlaylistInfo
			if ("entries" in info) {
				return json(
					{
						error: "Playlists werden nicht unterstützt. Bitte nur einzelne Videos.",
					},
					{ status: 400 }
				);
			}

			// Check duration (max 1 hour = 3600 seconds)
			if (info.duration && info.duration > 3600) {
				const minutes = Math.floor(info.duration / 60);
				return json(
					{
						error: `Video zu lang (${minutes} Minuten). Maximal 60 Minuten erlaubt.`,
					},
					{ status: 400 }
				);
			}
		} catch (infoError: any) {
			console.error("ytdlp info error:", infoError);
			return json(
				{
					error: "Konnte Video-Informationen nicht abrufen. Bitte überprüfe die URL.",
				},
				{ status: 400 }
			);
		}

		// Generate temp filename
		const tempId = randomBytes(8).toString("hex");
		const outputPath = join(TEMP_DIR, `${tempId}.mp3`);

		console.log(`[YOUTUBE] Starting download:`, {
			url: videoUrl,
			tempId,
		});

		// Download with ytdlp-nodejs
		try {
			// Use system yt-dlp binary (set via YTDLP_BINARY env var) or fallback to yt-dlp in PATH
			const binaryPath = process.env.YTDLP_BINARY || "yt-dlp";
			const ytdlp = new YtDlp({ binaryPath });
			await ytdlp.downloadAsync(videoUrl, {
				format: {
					filter: "audioonly",
					type: "mp3",
					quality: 5,
				},
				output: outputPath,
			});
		} catch (execError: any) {
			console.error(`[YOUTUBE] Download failed:`, {
				url: videoUrl,
				error: execError.message || execError,
			});
			return json(
				{
					error: "Download fehlgeschlagen. Bitte überprüfe die URL.",
				},
				{ status: 400 }
			);
		}

		// Check if file was downloaded
		if (!existsSync(outputPath)) {
			return json({ error: "Download fehlgeschlagen" }, { status: 500 });
		}

		downloadedPath = outputPath;
		const fileStats = await stat(outputPath);
		if (fileStats.size > 100 * 1024 * 1024) {
			await unlink(downloadedPath);
			return json({ error: "Datei zu groß (max. 100MB)" }, { status: 400 });
		}

		// Store file
		const filename = `${tempId}.mp3`;
		const fileBuffer = await readFile(outputPath);
		const storedFile = await storeFile(fileBuffer, filename, "audio/mpeg");

		console.log(`[YOUTUBE] Download completed successfully:`, {
			id: storedFile.id,
			url: videoUrl,
			filename: storedFile.filename,
			size: storedFile.size,
			expiresAt: storedFile.expiresAt.toISOString(),
		});

		// Return path only
		const filePath = `/api/files/${storedFile.id}`;

		return json({
			url: filePath,
			expiresAt: storedFile.expiresAt.toISOString(),
			filename: storedFile.filename,
			size: storedFile.size,
		});
	} catch (err) {
		console.error("Download error:", err);

		// Clean up temp file if exists
		if (downloadedPath && existsSync(downloadedPath)) {
			try {
				await unlink(downloadedPath);
			} catch {}
		}

		return json({ error: "Download fehlgeschlagen" }, { status: 500 });
	}
};
