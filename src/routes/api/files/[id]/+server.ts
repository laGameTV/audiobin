import type { RequestHandler } from "./$types";
import { getFile } from "$lib/server/storage";
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
