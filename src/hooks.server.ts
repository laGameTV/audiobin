import { startCleanupJob, loadExistingFiles } from "$lib/server/storage";
import type { Handle } from "@sveltejs/kit";

// Load existing files from disk and start cleanup job when server starts
await loadExistingFiles();
startCleanupJob();

// Handle hook to configure request body size limit
export const handle: Handle = async ({ event, resolve }) => {
	// Allow larger request bodies for file uploads (500MB)
	return resolve(event);
};
