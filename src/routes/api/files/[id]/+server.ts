import type { RequestHandler } from "./$types";
import { getFile, deleteFile } from "$lib/server/storage";
import { readFile } from "fs/promises";

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return new Response("Datei nicht gefunden", { status: 404 });
	}

	const file = getFile(id);

	if (!file) {
		return new Response("Datei nicht gefunden oder abgelaufen", { status: 404 });
	}

	try {
		const buffer = await readFile(file.path);

		console.log(`[DOWNLOAD] File accessed:`, {
			id: file.id,
			filename: file.filename,
			size: file.size,
			mimeType: file.mimeType,
		});

		return new Response(buffer, {
			headers: {
				"Content-Type": file.mimeType,
				"Content-Length": file.size.toString(),
				"Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (err) {
		console.error("File read error:", err);
		return new Response("Fehler beim Laden der Datei", { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return new Response(JSON.stringify({ error: "Datei nicht gefunden" }), {
			status: 404,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	const success = await deleteFile(id);

	if (success) {
		console.log(`[DELETE] File deleted manually:`, { id });
	}

	if (!success) {
		return new Response(JSON.stringify({ error: "Datei nicht gefunden oder bereits gelöscht" }), {
			status: 404,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	return new Response(JSON.stringify({ message: "Datei gelöscht" }), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});
};
