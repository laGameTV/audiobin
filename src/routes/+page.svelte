<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import CopyButton from '$lib/components/ui/copy-button/copy-button.svelte';
	import MusicIcon from '@lucide/svelte/icons/music';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { onMount } from 'svelte';

	interface StoredFile {
		id: string;
		url: string;
		filename: string;
		expiresAt: string;
	}

	let storedFiles = $state<StoredFile[]>([]);

	// LocalStorage Management
	function getStoredFiles(): StoredFile[] {
		if (typeof window === 'undefined') return [];
		const stored = localStorage.getItem('audiobin-files');
		if (!stored) return [];
		try {
			return JSON.parse(stored);
		} catch {
			return [];
		}
	}

	function saveStoredFiles(files: StoredFile[]) {
		if (typeof window === 'undefined') return;
		localStorage.setItem('audiobin-files', JSON.stringify(files));
	}

	function removeStoredFile(id: string) {
		const files = getStoredFiles().filter(f => f.id !== id);
		saveStoredFiles(files);
		storedFiles = files;
	}

	function cleanupExpiredFiles() {
		const now = new Date();
		const files = getStoredFiles().filter(f => {
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
		
		if (minutes < 1) return 'weniger als 1 Minute';
		if (minutes === 1) return '1 Minute';
		return `${minutes} Minuten`;
	}
</script>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-2xl">
		<!-- Header -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-semibold text-foreground mb-2">AudioBin</h1>
			<p class="text-muted-foreground text-sm">
				Teile Audio-Dateien schnell und einfach
			</p>
		</div>

<!-- Landing Page -->
{#if storedFiles.length > 0}
	<!-- Files List -->
	<div class="space-y-4">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-foreground text-lg font-medium">Deine Dateien</h2>
			<Button size="sm" href="/upload">
				<PlusIcon class="w-4 h-4 mr-1" />
				Neue Datei
			</Button>
		</div>
		
		<div class="space-y-2">
			{#each storedFiles as file}
				<div class="bg-card rounded-lg p-4 border">
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<p class="text-foreground text-sm font-medium truncate">{file.filename}</p>
							<p class="text-muted-foreground text-xs mt-1">
								Läuft ab in {formatTimeRemaining(new Date(file.expiresAt))}
							</p>
							<div class="flex gap-2 mt-3">
								<CopyButton text={file.url} size="sm" variant="outline" class="flex-1">
									{#snippet icon()}
										<CopyIcon />
									{/snippet}
									<span class="text-xs truncate">Link kopieren</span>
								</CopyButton>
								<Button 
									size="sm" 
									variant="outline"
									onclick={() => window.open(file.url, '_blank')}
								>
									Öffnen
								</Button>
							</div>
						</div>
						<Button 
							size="sm" 
							variant="ghost"
							onclick={() => removeStoredFile(file.id)}
						>
							<TrashIcon class="w-4 h-4" />
						</Button>
					</div>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<!-- Empty State -->
	<div class="bg-card rounded-lg p-12 border text-center">
		<div class="flex flex-col items-center gap-4">
			<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
				<MusicIcon class="w-8 h-8 text-muted-foreground" />
			</div>
			<div>
				<h2 class="text-foreground text-lg font-medium mb-2">Keine Dateien</h2>
				<p class="text-muted-foreground text-sm">
					Du hast noch keine Audio-Dateien hochgeladen. Starte jetzt mit deinem ersten Upload.
				</p>
			</div>
			<Button href="/upload" class="mt-2">
				<PlusIcon class="w-4 h-4 mr-2" />
				Datei hochladen
			</Button>
		</div>
	</div>
{/if}
		
		<!-- Footer -->
		<div class="text-center mt-6 text-muted-foreground text-xs">
			<p>Dateien werden nach 1 Stunde gelöscht</p>
		</div>
	</div>
</div>
