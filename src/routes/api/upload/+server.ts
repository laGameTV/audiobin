import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { storeFile } from "$lib/server/storage";

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const formData = await request.formData();
		const file = formData.get("file") as File;

		if (!file) {
			return json({ error: "Keine Datei hochgeladen" }, { status: 400 });
		}

		// Check if it's an audio file
		if (!file.type.startsWith("audio/")) {
			return json({ error: "Nur Audio-Dateien erlaubt" }, { status: 400 });
		}

		// Check file size (100MB max)
		const maxSize = 100 * 1024 * 1024;
		if (file.size > maxSize) {
			return json({ error: "Datei zu groß (max. 100MB)" }, { status: 400 });
		}

		// Convert file to buffer
		const buffer = Buffer.from(await file.arrayBuffer());

		// Store file
		const storedFile = await storeFile(buffer, file.name, file.type);

		console.log(`[UPLOAD] File uploaded successfully:`, {
			id: storedFile.id,
			filename: file.name,
			size: file.size,
			mimeType: file.type,
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
		console.error("Upload error:", err);
		return json({ error: "Upload fehlgeschlagen" }, { status: 500 });
	}
};
