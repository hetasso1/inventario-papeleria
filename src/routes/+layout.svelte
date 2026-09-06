<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		Store,
		Package,
		History,
		ShieldCheck,
		LogOut,
		Menu,
		X,
		UserCheck,
		Shield,
		Layers
	} from 'lucide-svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

	let mobileMenuOpen = $state(false);

	// Check if current route is login or if user is unauthenticated
	let isLoginPage = $derived(page.url.pathname === '/login' || page.url.pathname === '/');
	let currentPath = $derived(page.url.pathname);
	let user = $derived(data.user);
	let role = $derived(data.role ?? data.user?.role ?? 'cajero');
	let isAdmin = $derived(role === 'admin');

	// Breadcrumb title derivation
	let pageTitle = $derived.by(() => {
		if (currentPath === '/caja') return 'Punto de Venta (Caja)';
		if (currentPath.startsWith('/admin/productos')) return 'Gestión de Productos';
		if (currentPath.startsWith('/admin/historial')) return 'Historial de Salidas';
		if (currentPath.startsWith('/admin/auditoria')) return 'Auditoría de Devoluciones';
		return 'Inventario Papelería';
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isLoginPage}
	<!-- Plain layout for login -->
	<div class="min-h-screen bg-background text-foreground font-sans">
		{@render children()}
	</div>
{:else}
	<!-- Shadcn Admin & POS App Layout (Sidebar + Top Navbar) -->
	<div class="min-h-screen bg-background text-foreground font-sans flex flex-col md:flex-row">
		<!-- Desktop Sidebar -->
		<aside
			class="hidden md:flex w-64 flex-col border-r border-border bg-card text-card-foreground shrink-0 select-none"
		>
			<!-- Brand / Header -->
			<div class="h-16 flex items-center gap-3 px-5 border-b border-border">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900 shadow-sm"
				>
					<Layers class="h-5 w-5" strokeWidth={1.5} />
				</div>
				<div class="flex flex-col">
					<span class="font-semibold text-sm tracking-tight text-foreground">Papelería POS</span>
					<span class="text-[11px] text-muted-foreground">Sistema de Control</span>
				</div>
			</div>

			<!-- Navigation Sections -->
			<div class="flex-1 overflow-y-auto px-3 py-4 space-y-6">
				<!-- Operaciones -->
				<div>
					<div class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
						Operación
					</div>
					<nav class="space-y-1">
						<a
							href="/caja"
							class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors {currentPath === '/caja'
								? 'bg-accent text-accent-foreground font-semibold shadow-xs'
								: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
						>
							<Store class="h-4 w-4 shrink-0" strokeWidth={1.5} />
							<span>Caja / Venta</span>
						</a>
					</nav>
				</div>

				<!-- Administración (Sólo Admin) -->
				{#if isAdmin}
					<div>
						<div class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Administración
						</div>
						<nav class="space-y-1">
							<a
								href="/admin/productos"
								class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors {currentPath.startsWith(
									'/admin/productos'
								)
									? 'bg-accent text-accent-foreground font-semibold shadow-xs'
									: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
							>
								<Package class="h-4 w-4 shrink-0" strokeWidth={1.5} />
								<span>Productos & Costos</span>
							</a>

							<a
								href="/admin/historial"
								class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors {currentPath.startsWith(
									'/admin/historial'
								)
									? 'bg-accent text-accent-foreground font-semibold shadow-xs'
									: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
							>
								<History class="h-4 w-4 shrink-0" strokeWidth={1.5} />
								<span>Historial de Salidas</span>
							</a>

							<a
								href="/admin/auditoria"
								class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors {currentPath.startsWith(
									'/admin/auditoria'
								)
									? 'bg-accent text-accent-foreground font-semibold shadow-xs'
									: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
							>
								<ShieldCheck class="h-4 w-4 shrink-0" strokeWidth={1.5} />
								<span>Auditoría & Logs</span>
							</a>
						</nav>
					</div>
				{/if}
			</div>

			<!-- User Footer -->
			<div class="p-3 border-t border-border bg-card/50">
				<div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-accent/40 border border-border">
					<div class="flex items-center gap-2.5 min-w-0">
						<div
							class="h-8 w-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0"
						>
							{#if isAdmin}
								<Shield class="h-4 w-4 text-amber-500" strokeWidth={1.5} />
							{:else}
								<UserCheck class="h-4 w-4 text-slate-400" strokeWidth={1.5} />
							{/if}
						</div>
						<div class="flex flex-col min-w-0">
							<span class="text-xs font-medium text-foreground truncate">{user?.email ?? 'Usuario'}</span>
							<span class="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
								{role}
							</span>
						</div>
					</div>

					<form action="/logout" method="POST">
						<button
							type="submit"
							title="Cerrar sesión"
							aria-label="Cerrar sesión"
							class="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
						>
							<LogOut class="h-4 w-4" strokeWidth={1.5} />
						</button>
					</form>
				</div>
			</div>
		</aside>

		<!-- Mobile Header & Drawer -->
		<div class="md:hidden border-b border-border bg-card">
			<div class="h-14 px-4 flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900 shadow-sm"
					>
						<Layers class="h-4 w-4" strokeWidth={1.5} />
					</div>
					<span class="font-semibold text-sm tracking-tight text-foreground">Papelería POS</span>
				</div>

				<button
					type="button"
					onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
					class="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
					aria-label="Abrir menú"
				>
					{#if mobileMenuOpen}
						<X class="h-5 w-5" strokeWidth={1.5} />
					{:else}
						<Menu class="h-5 w-5" strokeWidth={1.5} />
					{/if}
				</button>
			</div>

			<!-- Mobile Collapsible Menu -->
			{#if mobileMenuOpen}
				<div class="px-4 py-3 border-t border-border space-y-4 bg-card">
					<nav class="space-y-1">
						<a
							href="/caja"
							onclick={() => (mobileMenuOpen = false)}
							class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium {currentPath === '/caja'
								? 'bg-accent text-accent-foreground font-semibold'
								: 'text-muted-foreground hover:bg-accent/60'}"
						>
							<Store class="h-4 w-4" strokeWidth={1.5} />
							<span>Caja</span>
						</a>

						{#if isAdmin}
							<a
								href="/admin/productos"
								onclick={() => (mobileMenuOpen = false)}
								class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium {currentPath.startsWith(
									'/admin/productos'
								)
									? 'bg-accent text-accent-foreground font-semibold'
									: 'text-muted-foreground hover:bg-accent/60'}"
							>
								<Package class="h-4 w-4" strokeWidth={1.5} />
								<span>Productos</span>
							</a>

							<a
								href="/admin/historial"
								onclick={() => (mobileMenuOpen = false)}
								class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium {currentPath.startsWith(
									'/admin/historial'
								)
									? 'bg-accent text-accent-foreground font-semibold'
									: 'text-muted-foreground hover:bg-accent/60'}"
							>
								<History class="h-4 w-4" strokeWidth={1.5} />
								<span>Historial</span>
							</a>

							<a
								href="/admin/auditoria"
								onclick={() => (mobileMenuOpen = false)}
								class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium {currentPath.startsWith(
									'/admin/auditoria'
								)
									? 'bg-accent text-accent-foreground font-semibold'
									: 'text-muted-foreground hover:bg-accent/60'}"
							>
								<ShieldCheck class="h-4 w-4" strokeWidth={1.5} />
								<span>Auditoría</span>
							</a>
						{/if}
					</nav>

					<div class="pt-3 border-t border-border flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-xs text-muted-foreground truncate max-w-[180px]">{user?.email ?? 'Usuario'}</span>
							<Badge variant="secondary" class="text-[10px]">{role}</Badge>
						</div>

						<form action="/logout" method="POST">
							<Button type="submit" variant="ghost" size="sm" class="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive">
								<LogOut class="h-3.5 w-3.5" strokeWidth={1.5} />
								<span>Salir</span>
							</Button>
						</form>
					</div>
				</div>
			{/if}
		</div>

		<!-- Main Workspace Area -->
		<div class="flex-1 flex flex-col min-w-0 bg-background">
			<!-- Top Navbar (Desktop Breadcrumb & Quick Info) -->
			<header
				class="hidden md:flex h-16 items-center justify-between px-6 lg:px-8 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30"
			>
				<!-- Breadcrumbs / Page Identity -->
				<div class="flex items-center gap-2 text-sm">
					<span class="text-muted-foreground">Sistema</span>
					<span class="text-muted-foreground">/</span>
					<span class="font-semibold tracking-tight text-foreground">{pageTitle}</span>
				</div>

				<!-- Quick Status Pill & Role Badge -->
				<div class="flex items-center gap-3">
					<Badge variant="outline" class="gap-1.5 px-3 py-1 font-mono text-xs">
						<span class="h-2 w-2 rounded-full {isAdmin ? 'bg-amber-400' : 'bg-emerald-400'}"></span>
						<span class="capitalize">{role}</span>
					</Badge>
				</div>
			</header>

			<!-- Child Content Viewport -->
			<main class="flex-1 overflow-auto">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
