import { startCleanupJob } from "$lib/server/storage";

// Start cleanup job when server starts
startCleanupJob();

console.log("File cleanup cronjob started - runs every minute");
