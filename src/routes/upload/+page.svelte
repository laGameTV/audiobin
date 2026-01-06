<script lang="ts">
	import FileDropZone from "$lib/components/ui/file-drop-zone/file-drop-zone.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Meter } from "$lib/components/ui/meter";
	import CopyButton from "$lib/components/ui/copy-button/copy-button.svelte";
	import { ArrowLeftIcon, ClockFadingIcon, CopyIcon, ServerCrashIcon } from "@lucide/svelte";
	import { goto } from "$app/navigation";

	interface StoredFile {
		id: string;
		url: string;
		filename: string;
		expiresAt: string;
	}

	let url = $state("");
	let uploadedUrl = $state("");
	let error = $state("");
	let loading = $state(false);
	let progress = $state(0);
	let expiresAt = $state<Date | null>(null);
	let videoInfo = $state<{ title: string; duration: number; durationFormatted: string } | null>(null);
	let fetchingInfo = $state(false);

	function logAction(action: string, details: any) {
		const timestamp = new Date().toISOString();
		console.log(`[AudioBin ${timestamp}] ${action}:`, details);
	}

	async function fetchVideoInfo() {
		if (!url.trim()) {
			videoInfo = null;
			return;
		}

		fetchingInfo = true;
		videoInfo = null;

		try {
			const response = await fetch("/api/info", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ url: url.trim() }),
			});

			if (!response.ok) {
				throw new Error("Konnte Video-Info nicht abrufen");
			}

			const data = await response.json();
			videoInfo = data;
		} catch (err) {
			// Silently fail - no video info available
			videoInfo = null;
		} finally {
			fetchingInfo = false;
		}
	}

	function addStoredFile(file: StoredFile) {
		if (typeof window === "undefined") return;
		const stored = localStorage.getItem("audiobin-files");
		const files: StoredFile[] = stored ? JSON.parse(stored) : [];
		files.unshift(file);
		localStorage.setItem("audiobin-files", JSON.stringify(files));
	}

	async function handleFileUpload(files: File[]) {
		if (files.length === 0) return;

		const file = files[0];

		if (!file.type.startsWith("audio/")) {
			error = "Bitte nur Audio-Dateien hochladen (MP3, WAV, etc.)";
			return;
		}

		error = "";
		loading = true;
		progress = 0;

		logAction("FILE_UPLOAD_START", {
			filename: file.name,
			size: file.size,
			type: file.type,
		});

		const formData = new FormData();
		formData.append("file", file);

		try {
			const xhr = new XMLHttpRequest();

			xhr.upload.addEventListener("progress", (e) => {
				if (e.lengthComputable) {
					progress = (e.loaded / e.total) * 100;
				}
			});

			const response = await new Promise<{ url: string; expiresAt: string }>((resolve, reject) => {
				xhr.open("POST", "/api/upload");

				xhr.onload = () => {
					if (xhr.status === 200) {
						resolve(JSON.parse(xhr.responseText));
					} else {
						reject(new Error(JSON.parse(xhr.responseText).error || "Upload fehlgeschlagen"));
					}
				};

				xhr.onerror = () => reject(new Error("Upload fehlgeschlagen"));
				xhr.send(formData);
			});

			const fullUrl = window.location.origin + response.url;
			uploadedUrl = response.url;
			expiresAt = new Date(response.expiresAt);
			progress = 100;

			const urlParts = response.url.split("/");
			const fileId = urlParts[urlParts.length - 1];

			logAction("FILE_UPLOAD_SUCCESS", {
				fileId,
				filename: file.name,
				size: file.size,
				url: response.url,
				expiresAt: response.expiresAt,
			});

			addStoredFile({
				id: fileId,
				url: response.url,
				filename: file.name,
				expiresAt: response.expiresAt,
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
			logAction("FILE_UPLOAD_ERROR", {
				filename: file.name,
				error: errorMsg,
			});
			error = errorMsg;
			progress = 0;
		} finally {
			loading = false;
		}
	}

	async function handleUrlDownload() {
		if (!url.trim()) {
			error = "Bitte eine URL eingeben";
			return;
		}

		error = "";
		loading = true;
		progress = 0;

		logAction("URL_DOWNLOAD_START", {
			url: url.trim(),
		});

		try {
			const response = await fetch("/api/download", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ url: url.trim() }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Download fehlgeschlagen");
			}

			const data = await response.json();
			const fullUrl = window.location.origin + data.url;
			uploadedUrl = data.url;
			expiresAt = new Date(data.expiresAt);
			progress = 100;

			const urlParts = data.url.split("/");
			const fileId = urlParts[urlParts.length - 1];

			logAction("URL_DOWNLOAD_SUCCESS", {
				fileId,
				sourceUrl: url.trim(),
				filename: data.filename || "Downloaded Audio",
				url: data.url,
				expiresAt: data.expiresAt,
			});

			addStoredFile({
				id: fileId,
				url: data.url,
				filename: data.filename || "Downloaded Audio",
				expiresAt: data.expiresAt,
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Download fehlgeschlagen";
			logAction("URL_DOWNLOAD_ERROR", {
				url: url.trim(),
				error: errorMsg,
			});
			error = errorMsg;
		} finally {
			loading = false;
		}
	}

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
		<!-- Header -->
		<div class="mb-4 w-full flex items-center justify-end text-foreground">
			<Button variant="ghost" onclick={() => goto("/")}><ArrowLeftIcon /> Zur Übersicht</Button>
		</div>
		{#if !uploadedUrl}
			<!-- Upload Card -->
			<Card>
				<!-- <CardHeader class="pb-3">
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm font-medium">Datei hochladen</CardTitle>
					<Button variant="ghost" onclick={() => goto('/')}>
						Zur Übersicht
					</Button>
				</div>
				</CardHeader> -->
				<CardContent class="space-y-4">
					<!-- File Drop Zone -->
					<div>
						<Label class="text-xs text-muted-foreground mb-2.5">Datei hochladen</Label>
						<FileDropZone
							accept="audio/*"
							maxFiles={1}
							fileCount={uploadedUrl ? 1 : 0}
							maxFileSize={100 * 1024 * 1024}
							disabled={loading}
							onUpload={handleFileUpload}
							onFileRejected={({ reason }) => {
								if (reason === "Maximum file size exceeded") {
									error = "Datei ist zu groß (max. 100MB)";
								} else if (reason === "File type not allowed") {
									error = "Nur Audio-Dateien erlaubt";
								}
							}}
							class="border-2 border-dashed rounded-lg"
						/>
					</div>

					<!-- Divider -->
					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t"></div>
						</div>
						<div class="relative flex justify-center text-xs">
							<span class="px-2 bg-background text-muted-foreground">oder</span>
						</div>
					</div>

					<!-- URL Input -->
					<div>
						<Label class="text-xs text-muted-foreground mb-2.5">Von URL laden (YouTube, SoundCloud, etc. - Kein Spotify)</Label>
						<div class="flex gap-2">
							<div class="flex-1">
								<Input
									type="url"
									bind:value={url}
									disabled={loading}
									placeholder="https://"
									onkeydown={(e) => {
										if (e.key === "Enter" && !loading) {
											handleUrlDownload();
										}
									}}
									onpaste={() => {
										setTimeout(() => fetchVideoInfo(), 100);
									}}
									onblur={() => fetchVideoInfo()}
								/>
							</div>
							<Button onclick={handleUrlDownload} disabled={loading || !url.trim()}>
								{loading ? "Lädt..." : "Laden"}
							</Button>
						</div>
						{#if fetchingInfo}
							<p class="text-xs text-muted-foreground mt-1.5">Lädt URL-Informationen...</p>
						{:else if videoInfo}
							<p class="text-xs text-muted-foreground mt-1.5">
								<strong>{videoInfo.title}</strong> • {videoInfo.durationFormatted}
								{#if videoInfo.duration > 3600}
									<span class="text-destructive"> (zu lang, max. 60 Min.)</span>
								{/if}
							</p>
						{:else}
							<p class="text-xs text-muted-foreground mt-1.5">Füge eine URL ein...</p>
						{/if}
					</div>

					<!-- Progress -->
					{#if loading && progress > 0}
						<div class="mt-6">
							<div class="flex justify-between text-sm text-muted-foreground mb-2">
								<span>Upload läuft...</span>
								<span>{Math.round(progress)}%</span>
							</div>
							<Meter value={progress} max={100} class="h-2" />
						</div>
					{/if}

					<!-- Error -->
					{#if error}
						<div class="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
							<ServerCrashIcon class="w-4 h-4 text-destructive shrink-0 mt-0.5" />
							<p class="text-destructive text-xs">{error}</p>
						</div>
					{/if}
				</CardContent>
			</Card>
		{:else}
			<!-- Success Card -->
			<Card>
				<!-- <CardHeader class="pb-3">
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm font-medium flex items-center gap-2">
						<CheckCircleIcon class="w-4 h-4 text-primary" />
						Datei hochgeladen
					</CardTitle>
					<Button variant="ghost" onclick={() => goto('/')}>
						Zur Übersicht
					</Button>
				</div>
				</CardHeader> -->
				<CardContent class="space-y-4">
					<!-- URL Display -->
					<div>
						<Label class="text-xs text-muted-foreground mb-1.5">Direkt-Link</Label>
						<CopyButton text={window.location.origin + uploadedUrl} size="sm" variant="outline" class="w-full justify-start h-8">
							{#snippet icon()}
								<CopyIcon class="w-3.5 h-3.5" />
							{/snippet}
							<span class="truncate text-xs">{window.location.origin + uploadedUrl}</span>
						</CopyButton>
					</div>

					<div>
						<Label class="text-xs text-muted-foreground mb-1.5">Import Command</Label>
						<CopyButton
							text={`/audioplayer url "${window.location.origin + uploadedUrl}"`}
							size="sm"
							variant="outline"
							class="w-full justify-start h-8"
						>
							{#snippet icon()}
								<CopyIcon class="w-3.5 h-3.5" />
							{/snippet}
							<span class="truncate text-xs">{`/audioplayer url "${window.location.origin + uploadedUrl}"`}</span>
						</CopyButton>
					</div>

					<!-- Expiration Info -->
					{#if expiresAt}
						<p class="text-xs text-muted-foreground inline-flex items-center gap-1">
							<ClockFadingIcon size={16} /> Läuft ab in <strong>{formatTimeRemaining(expiresAt)}</strong>
						</p>
					{/if}

					<!-- Actions -->
					<Button
						onclick={() => {
							uploadedUrl = "";
							expiresAt = null;
						}}
						variant="default"
						size="sm"
						class="w-full"
					>
						Weitere Datei hochladen
					</Button>
				</CardContent>
			</Card>
		{/if}

		<!-- Footer -->
		<div class="text-center mt-6 text-muted-foreground text-xs">
			<p>Dateien werden nach einer Stunde gelöscht</p>
		</div>
	</div>
</div>
