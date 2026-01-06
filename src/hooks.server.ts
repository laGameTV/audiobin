import { startCleanupJob, loadExistingFiles } from "$lib/server/storage";

// Load existing files from disk and start cleanup job when server starts
await loadExistingFiles();
startCleanupJob();
