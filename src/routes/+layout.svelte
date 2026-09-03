<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	// Check if current route is login or if user is unauthenticated
	let isLoginPage = $derived(page.url.pathname === '/login' || page.url.pathname === '/');
	let currentPath = $derived(page.url.pathname);
	let user = $derived(data.user);
	let role = $derived(data.role ?? data.user?.role ?? 'cajero');
	let isAdmin = $derived(role === 'admin');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
	{#if !isLoginPage}
		<!-- Global Navigation Header -->
		<header class="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-16 gap-4">
					<!-- Brand / Logo -->
					<div class="flex items-center gap-6">
						<a href="/caja" class="flex items-center gap-3 group">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform duration-200">
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
								</svg>
							</div>
							<div class="hidden sm:block">
								<span class="font-bold text-base tracking-tight text-white group-hover:text-indigo-300 transition-colors">Papelería POS</span>
								<span class="block text-[10px] uppercase font-semibold tracking-wider text-slate-400">Inventario & Ventas</span>
							</div>
						</a>

						<!-- Navigation Links -->
						<nav class="flex items-center gap-1.5 sm:gap-2">
							<!-- Caja (Always visible) -->
							<a
								href="/caja"
								class="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-1.5 {currentPath === '/caja'
									? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
									: 'text-slate-300 hover:text-white hover:bg-slate-800/60'}"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
								</svg>
								<span>Caja</span>
							</a>

							<!-- Admin Navigation (Only if Admin) -->
							{#if isAdmin}
								<a
									href="/admin/productos"
									class="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-1.5 {currentPath.startsWith('/admin/productos')
										? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
										: 'text-slate-300 hover:text-white hover:bg-slate-800/60'}"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
									</svg>
									<span>Productos</span>
								</a>

								<a
									href="/admin/historial"
									class="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-1.5 {currentPath.startsWith('/admin/historial')
										? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
										: 'text-slate-300 hover:text-white hover:bg-slate-800/60'}"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
									</svg>
									<span>Historial</span>
								</a>

								<a
									href="/admin/auditoria"
									class="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center gap-1.5 {currentPath.startsWith('/admin/auditoria')
										? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
										: 'text-slate-300 hover:text-white hover:bg-slate-800/60'}"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
									</svg>
									<span>Auditoría</span>
								</a>
							{/if}
						</nav>
					</div>

					<!-- User Info & Logout Button -->
					<div class="flex items-center gap-3">
						<!-- Role & Email Badge -->
						<div class="hidden md:flex items-center gap-2 rounded-xl bg-slate-800/80 px-3 py-1.5 border border-slate-700/60 text-xs">
							<span class="h-2 w-2 rounded-full {isAdmin ? 'bg-amber-400 ring-2 ring-amber-400/30 animate-pulse' : 'bg-indigo-400'}"></span>
							<span class="text-slate-300 font-medium truncate max-w-[140px]">{user?.email ?? 'Usuario'}</span>
							<span class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider {isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}">
								{role}
							</span>
						</div>

						<!-- Logout Form -->
						<form action="/logout" method="POST">
							<button
								type="submit"
								title="Cerrar sesión"
								class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg text-slate-300 bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 border border-slate-700/60 transition-all duration-150"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
								</svg>
								<span class="hidden sm:inline">Salir</span>
							</button>
						</form>
					</div>
				</div>
			</div>
		</header>
	{/if}

	<!-- Main Content Slot -->
	<main class="flex-1">
		{@render children()}
	</main>
</div>
