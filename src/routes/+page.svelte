<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/login');
	});
</script>

<svelte:head>
	<title>Cargando Sistema — Inventario Papelería</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
	<div class="flex items-center gap-3">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
		<p class="text-sm font-medium">Redirigiendo al sistema...</p>
	</div>
</div>
