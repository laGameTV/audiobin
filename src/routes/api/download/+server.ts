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
	url: z.string().url("Ungültige URL"),
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
			return json({ error: result.error.errors[0].message }, { status: 400 });
		}

		const { url: videoUrl } = result.data;

		// Generate temp filename
		const tempId = randomBytes(8).toString("hex");
	const outputPath = join(TEMP_DIR, `${tempId}.mp3`);

	// Download with ytdlp-nodejs
	try {
		const ytdlp = new YtDlp();
		await ytdlp.downloadAsync(videoUrl, {
			format: {
				filter: "audioonly",
				type: "mp3",
				quality: 5
			},
			output: outputPath
		});
	} catch (execError: any) {
		console.error("ytdlp error:", execError);
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
		if (fileStats.size > 100 * 1024 * 1024) {
			await unlink(downloadedPath);
			return json({ error: "Datei zu groß (max. 100MB)" }, { status: 400 });
		}

		// Store file
	const filename = `${tempId}.mp3`;
	const storedFile = await storeFile(fileBuffer, filename, "audio/mpeg");

		// Build public URL
		const baseUrl = url.origin;
		const fileUrl = `${baseUrl}/api/files/${storedFile.id}`;

		return json({
			url: fileUrl,
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
