<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
	import CopyButton from "$lib/components/ui/copy-button/copy-button.svelte";
	import { MusicIcon, CopyIcon, PlusIcon, TrashIcon, ClockFadingIcon, LoaderCircleIcon } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";

	interface StoredFile {
		id: string;
		url: string;
		filename: string;
		expiresAt: string;
	}

	let storedFiles = $state<StoredFile[]>([]);
	let deletingFileId = $state<string | null>(null);

	function logAction(action: string, details: any) {
		const timestamp = new Date().toISOString();
		console.log(`[AudioBin ${timestamp}] ${action}:`, details);
	}

	// LocalStorage Management
	function getStoredFiles(): StoredFile[] {
		if (typeof window === "undefined") return [];
		const stored = localStorage.getItem("audiobin-files");
		if (!stored) return [];
		try {
			return JSON.parse(stored);
		} catch {
			return [];
		}
	}

	function saveStoredFiles(files: StoredFile[]) {
		if (typeof window === "undefined") return;
		localStorage.setItem("audiobin-files", JSON.stringify(files));
	}

	function removeStoredFile(id: string) {
		const files = getStoredFiles().filter((f) => f.id !== id);
		saveStoredFiles(files);
		storedFiles = files;
	}

	async function deleteFile(file: StoredFile) {
		deletingFileId = file.id;
		logAction("FILE_DELETE_START", {
			fileId: file.id,
			filename: file.filename,
		});

		try {
			// Delete from server
			const response = await fetch(`/api/files/${file.id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				logAction("FILE_DELETE_SERVER_ERROR", {
					fileId: file.id,
					filename: file.filename,
					status: response.status,
				});
			} else {
				logAction("FILE_DELETE_SUCCESS", {
					fileId: file.id,
					filename: file.filename,
				});
			}
		} catch (err) {
			logAction("FILE_DELETE_ERROR", {
				fileId: file.id,
				filename: file.filename,
				error: err instanceof Error ? err.message : "Unknown error",
			});
		} finally {
			// Always remove from local storage
			removeStoredFile(file.id);
			deletingFileId = null;
		}
	}

	function cleanupExpiredFiles() {
		const now = new Date();
		const allFiles = getStoredFiles();
		const expiredFiles = allFiles.filter((f) => {
			const expires = new Date(f.expiresAt);
			return expires <= now;
		});

		if (expiredFiles.length > 0) {
			logAction("FILES_CLEANUP", {
				expiredCount: expiredFiles.length,
				files: expiredFiles.map((f) => ({
					id: f.id,
					filename: f.filename,
					expiresAt: f.expiresAt,
				})),
			});
		}

		const files = allFiles.filter((f) => {
			const expires = new Date(f.expiresAt);
			return expires > now;
		});
		saveStoredFiles(files);
		storedFiles = files;
	}

	onMount(() => {
		cleanupExpiredFiles();
	});

	function formatTimeRemaining(expires: Date): string {
		const now = new Date();
		const diff = expires.getTime() - now.getTime();
		const minutes = Math.floor(diff / 60000);

		if (minutes < 1) return "weniger als einer Minute";
		if (minutes === 1) return "einer Minute";
		return `${minutes} Minuten`;
	}
</script>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-xl">
		<!-- Landing Page -->
		{#if storedFiles.length > 0}
			<!-- Files List -->
			<div class="space-y-3">
				<div class="mb-4 w-full flex items-center justify-end text-foreground">
					<Button variant="default" onclick={() => goto("/upload")}><PlusIcon size={16} /> Datei hochladen</Button>
				</div>

				<div class="space-y-4">
					{#each storedFiles as file}
						<Card>
							<CardHeader class="-mb-3">
								<div class="flex items-center justify-between">
									<CardTitle class="text-sm font-medium truncate pr-2">{file.filename}</CardTitle>
									<Button size="sm" variant="ghost" disabled={deletingFileId === file.id} onclick={() => deleteFile(file)}>
										{#if deletingFileId === file.id}
											<LoaderCircleIcon size={16} class="animate-spin" />
										{:else}
											<TrashIcon size={16} />
										{/if}
									</Button>
								</div>
							</CardHeader>
							<CardContent class="space-y-4">
								<div>
									<Label class="text-xs text-muted-foreground mb-1.5">Direkt-Link</Label>
									<CopyButton text={file.url} size="sm" variant="outline" class="w-full justify-start h-8">
										{#snippet icon()}
											<CopyIcon class="w-3.5 h-3.5" />
										{/snippet}
										<span class="truncate text-xs">{file.url}</span>
									</CopyButton>
								</div>
								<div>
									<Label class="text-xs text-muted-foreground mb-1.5">Import Command</Label>
									<CopyButton text={`/audioplayer url ${file.url}`} size="sm" variant="outline" class="w-full justify-start h-8">
										{#snippet icon()}
											<CopyIcon class="w-3.5 h-3.5" />
										{/snippet}
										<span class="truncate text-xs">{`/audioplayer url ${file.url}`}</span>
									</CopyButton>
								</div>
								<p class="text-xs text-muted-foreground inline-flex items-center gap-1">
									<ClockFadingIcon size={16} /> Läuft ab in <strong>{formatTimeRemaining(new Date(file.expiresAt))}</strong>
								</p>
							</CardContent>
						</Card>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Empty State -->
			<Card>
				<CardContent class="p-8 text-center">
					<div class="flex flex-col items-center gap-3">
						<div class="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
							<MusicIcon class="w-5 h-5 text-muted-foreground" />
						</div>
						<div>
							<h2 class="text-sm font-medium mb-1">Keine Dateien</h2>
							<p class="text-xs text-muted-foreground">Lade deine erste Audio-Datei hoch</p>
						</div>
						<Button href="/upload" size="sm">
							<PlusIcon class="w-3.5 h-3.5 mr-1.5" />
							Datei hochladen
						</Button>
					</div>
				</CardContent>
			</Card>
		{/if}

		<!-- Footer -->
		<div class="text-center mt-6 text-muted-foreground text-xs">
			<p>Dateien werden nach einer Stunde gelöscht</p>
		</div>
	</div>
</div>
