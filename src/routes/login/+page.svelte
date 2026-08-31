<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let email = $state(form?.email ?? '');
	let password = $state('');
	let loading = $state(false);
</script>

<svelte:head>
	<title>Iniciar Sesión — Inventario Papelería</title>
	<meta name="description" content="Acceso al sistema de inventario y punto de venta para papelería." />
</svelte:head>

<main class="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 text-slate-100 selection:bg-indigo-500 selection:text-white">
	<div class="w-full max-w-md space-y-8 rounded-2xl bg-slate-800/80 p-8 shadow-2xl backdrop-blur-xl border border-slate-700/60 transition-all duration-300">
		<div class="text-center">
			<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/30">
				<svg class="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			</div>
			<h1 class="mt-4 text-2xl font-bold tracking-tight text-white">Inventario Papelería</h1>
			<p class="mt-1 text-sm text-slate-400">Ingrese sus credenciales autorizadas para acceder</p>
		</div>

		{#if form?.error}
			<div
				id="login-error-alert"
				role="alert"
				class="rounded-lg bg-red-950/60 border border-red-500/40 p-4 text-sm text-red-300 flex items-center gap-3"
			>
				<svg class="h-5 w-5 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
				</svg>
				<span>{form.error}</span>
			</div>
		{/if}

		<form
			method="POST"
			class="mt-8 space-y-6"
			onsubmit={() => {
				loading = true;
			}}
		>
			<div class="space-y-4">
				<div>
					<label for="email" class="block text-sm font-medium text-slate-300">Correo Electrónico</label>
					<div class="mt-1.5">
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							placeholder="cajero@papeleria.local"
							class="block w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-slate-100 placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:text-sm"
						/>
					</div>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-slate-300">Contraseña</label>
					<div class="mt-1.5">
						<input
							id="password"
							name="password"
							type="password"
							autocomplete="current-password"
							required
							bind:value={password}
							placeholder="••••••••"
							class="block w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-slate-100 placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:text-sm"
						/>
					</div>
				</div>
			</div>

			<div>
				<button
					id="login-submit-button"
					type="submit"
					disabled={loading}
					class="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
				>
					{#if loading}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
						</svg>
						Iniciando sesión...
					{:else}
						Iniciar Sesión
					{/if}
				</button>
			</div>
		</form>
	</div>
</main>
