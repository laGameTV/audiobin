import { json } from "@sveltejs/kit";
import { z } from "zod";
import { YtDlp } from "ytdlp-nodejs";
import type { VideoInfo } from "ytdlp-nodejs";

const infoSchema = z.object({
	url: z.url("Ungültige URL"),
});

export const POST = async ({ request }: { request: Request }) => {
	try {
		const body = await request.json();

		// Validate with Zod
		const result = infoSchema.safeParse(body);
		if (!result.success) {
			return json({ error: result.error.issues[0].message }, { status: 400 });
		}

		const { url: videoUrl } = result.data;

		// Get video info
		try {
			const binaryPath = process.env.YTDLP_BINARY || "yt-dlp";
			const ytdlp = new YtDlp({ binaryPath });
			const info = await ytdlp.getInfoAsync(videoUrl, {
				additionalOptions: ["--extractor-args", "youtube:player_client=web", "--no-check-certificates", "--prefer-free-formats", "--no-warnings"],
			} as any);

			// Type guard to ensure we have a VideoInfo, not PlaylistInfo
			if ("entries" in info) {
				return json(
					{
						error: "Playlists werden nicht unterstützt. Bitte nur einzelne Videos.",
					},
					{ status: 400 }
				);
			}

			const videoInfo = info as VideoInfo;

			return json({
				title: videoInfo.title || "Unbekannt",
				duration: videoInfo.duration || 0,
				durationFormatted: formatDuration(videoInfo.duration || 0),
			});
		} catch (execError: any) {
			console.error("ytdlp info error:", execError);
			return json(
				{
					error: "Konnte Video-Informationen nicht abrufen.",
				},
				{ status: 400 }
			);
		}
	} catch (err) {
		console.error("Info error:", err);
		return json({ error: "Fehler beim Abrufen der Informationen" }, { status: 500 });
	}
};

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
