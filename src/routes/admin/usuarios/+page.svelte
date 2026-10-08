<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateModal = $state(false);
	let editingUser: any = $state(null);

	// Reactive feedback message
	let feedbackMessage = $state('');
	let feedbackType: 'success' | 'error' = $state('success');

	$effect(() => {
		if (form) {
			if ((form as any).success) {
				feedbackMessage = (form as any).message || 'Operación exitosa.';
				feedbackType = 'success';
				showCreateModal = false;
				editingUser = null;
			} else if ((form as any).error) {
				feedbackMessage = (form as any).error;
				feedbackType = 'error';
			}
			// Auto-clear after 5s
			setTimeout(() => { feedbackMessage = ''; }, 5000);
		}
	});

	function openEdit(user: any) {
		editingUser = { ...user };
	}

	function closeModals() {
		showCreateModal = false;
		editingUser = null;
	}
</script>

<svelte:head>
	<title>Gestión de Usuarios — Inventario Papelería</title>
	<meta name="description" content="Administración de usuarios cajeros del sistema de inventario." />
</svelte:head>

<div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
					Administración
				</span>
				<span class="text-xs text-slate-400">•</span>
				<span class="text-xs text-slate-500 font-medium">Control de Acceso</span>
			</div>
			<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
				Gestión de Usuarios
			</h1>
			<p class="text-sm text-slate-500 mt-1">
				Administración de cuentas y permisos de cajeros del sistema.
			</p>
		</div>

		<div class="flex items-center gap-3">
			<button
				id="btn-create-user"
				type="button"
				onclick={() => { showCreateModal = true; }}
				class="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-black/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all cursor-pointer"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<line x1="19" y1="8" x2="19" y2="14"/>
					<line x1="22" y1="11" x2="16" y2="11"/>
				</svg>
				Crear Cajero
			</button>
		</div>
	</div>

	<!-- Feedback Banner -->
	{#if feedbackMessage}
		<div
			role="status"
			id="feedback-banner"
			class="rounded-xl p-4 text-sm flex items-center justify-between shadow-sm {feedbackType === 'success'
				? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
				: 'bg-red-50 border border-red-200 text-red-700'}"
		>
			<div class="flex items-center gap-2.5">
				{#if feedbackType === 'success'}
					<svg class="h-5 w-5 text-emerald-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
					</svg>
				{:else}
					<svg class="h-5 w-5 text-red-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
					</svg>
				{/if}
				<span>{feedbackMessage}</span>
			</div>
		</div>
	{/if}

	<!-- Error from load -->
	{#if (data as any).error}
		<div role="alert" class="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center justify-between shadow-sm">
			<div class="flex items-center gap-2.5">
				<svg class="h-5 w-5 text-red-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
				</svg>
				<span>{(data as any).error}</span>
			</div>
		</div>
	{/if}

	<!-- Users Table -->
	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm text-slate-700" id="users-table">
				<thead class="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
					<tr>
						<th scope="col" class="px-4 py-3.5 font-semibold">Usuario</th>
						<th scope="col" class="px-4 py-3.5 font-semibold">Nombre</th>
						<th scope="col" class="px-4 py-3.5 text-center font-semibold">Rol</th>
						<th scope="col" class="px-4 py-3.5 text-center font-semibold">Estado</th>
						<th scope="col" class="px-4 py-3.5 text-right font-semibold">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.users as user (user.id)}
						<tr class="hover:bg-slate-50/60 transition-colors" data-user-id={user.id}>
							<td class="px-4 py-3.5">
								<div class="flex items-center gap-3">
									<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm border border-slate-200">
										{(user.display_name || user.username || '?')[0].toUpperCase()}
									</div>
									<div>
										<div class="font-semibold text-slate-900">{user.username}</div>
										<div class="text-xs text-slate-500 font-mono">{user.email}</div>
									</div>
								</div>
							</td>
							<td class="px-4 py-3.5 text-slate-700 font-medium">
								{user.display_name}
							</td>
							<td class="px-4 py-3.5 text-center">
								{#if user.role === 'admin'}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
										Admin
									</span>
								{:else}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
										Cajero
									</span>
								{/if}
							</td>
							<td class="px-4 py-3.5 text-center">
								{#if user.is_active}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
										<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
										Activo
									</span>
								{:else}
									<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
										<span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
										Inactivo
									</span>
								{/if}
							</td>
							<td class="px-4 py-3.5 text-right">
								<div class="flex items-center justify-end gap-1.5">
									<button
										type="button"
										onclick={() => openEdit(user)}
										class="rounded-lg p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
										title="Editar usuario"
										aria-label="Editar {user.username}"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
									</button>
									{#if user.role !== 'admin'}
										<form method="POST" action="?/toggle" use:enhance class="inline">
											<input type="hidden" name="user_id" value={user.id} />
											<input type="hidden" name="activate" value={user.is_active ? 'false' : 'true'} />
											<button
												type="submit"
												class="rounded-lg p-1.5 transition-colors cursor-pointer {user.is_active ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}"
												title={user.is_active ? 'Desactivar usuario' : 'Reactivar usuario'}
												aria-label={user.is_active ? `Desactivar ${user.username}` : `Reactivar ${user.username}`}
											>
												{#if user.is_active}
													<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
													</svg>
												{:else}
													<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
													</svg>
												{/if}
											</button>
										</form>
									{/if}
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="px-4 py-12 text-center text-slate-500">
								No hay usuarios registrados.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Summary -->
	<div class="text-xs text-slate-500 flex items-center gap-2">
		<span>Total: <strong class="text-slate-700">{data.users.length}</strong> {data.users.length === 1 ? 'usuario' : 'usuarios'}</span>
		<span>•</span>
		<span>Activos: <strong class="text-emerald-700">{data.users.filter((u: any) => u.is_active).length}</strong></span>
		<span>•</span>
		<span>Inactivos: <strong class="text-rose-700">{data.users.filter((u: any) => !u.is_active).length}</strong></span>
	</div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto"
		onclick={(e) => { if (e.target === e.currentTarget) closeModals(); }}
		role="dialog"
		aria-modal="true"
		aria-label="Crear nuevo usuario"
	>
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
			<div class="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
				<div>
					<h3 class="text-lg font-bold text-slate-900">Crear Nuevo Cajero</h3>
					<p class="text-xs text-slate-500 mt-0.5">Registre un nuevo usuario con rol de caja</p>
				</div>
				<button
					onclick={() => closeModals()}
					class="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
					aria-label="Cerrar"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form method="POST" action="?/create" use:enhance class="space-y-4">
				<div>
					<label for="create-username" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Usuario
					</label>
					<input
						type="text"
						id="create-username"
						name="username"
						required
						minlength="3"
						placeholder="ej: daniel"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div>
					<label for="create-display-name" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Nombre para Mostrar
					</label>
					<input
						type="text"
						id="create-display-name"
						name="display_name"
						required
						minlength="2"
						placeholder="ej: Daniel García"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div>
					<label for="create-password" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Contraseña
					</label>
					<input
						type="password"
						id="create-password"
						name="password"
						required
						minlength="6"
						placeholder="Mínimo 6 caracteres"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div>
					<label for="create-confirm-password" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Confirmar Contraseña
					</label>
					<input
						type="password"
						id="create-confirm-password"
						name="confirm_password"
						required
						minlength="6"
						placeholder="Repetir contraseña"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div class="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
					<strong>Rol fijo:</strong> Cajero — El rol de Administrador no puede asignarse desde esta interfaz.
				</div>

				<div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
					<button
						type="button"
						onclick={() => closeModals()}
						class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
					>
						Cancelar
					</button>
					<button
						type="submit"
						id="btn-submit-create"
						class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 shadow-sm transition-colors cursor-pointer"
					>
						Crear Cajero
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if editingUser}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto"
		onclick={(e) => { if (e.target === e.currentTarget) closeModals(); }}
		role="dialog"
		aria-modal="true"
		aria-label="Editar usuario"
	>
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
			<div class="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
				<div>
					<h3 class="text-lg font-bold text-slate-900">Editar Usuario: {editingUser.username}</h3>
					<p class="text-xs text-slate-500 mt-0.5">Modifique los datos o actualice la contraseña</p>
				</div>
				<button
					onclick={() => closeModals()}
					class="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
					aria-label="Cerrar"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form method="POST" action="?/update" use:enhance class="space-y-4">
				<input type="hidden" name="user_id" value={editingUser.id} />
				<div>
					<label for="edit-username" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Usuario
					</label>
					<input
						type="text"
						id="edit-username"
						name="username"
						required
						minlength="3"
						value={editingUser.username}
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div>
					<label for="edit-display-name" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Nombre para Mostrar
					</label>
					<input
						type="text"
						id="edit-display-name"
						name="display_name"
						required
						minlength="2"
						value={editingUser.display_name}
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div>
					<label for="edit-new-password" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Nueva Contraseña <span class="text-slate-400 font-normal lowercase">(dejar vacío para conservar)</span>
					</label>
					<input
						type="password"
						id="edit-new-password"
						name="new_password"
						minlength="6"
						placeholder="Mínimo 6 caracteres"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div>
					<label for="edit-confirm-password" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
						Confirmar Nueva Contraseña
					</label>
					<input
						type="password"
						id="edit-confirm-password"
						name="confirm_password"
						placeholder="Repetir nueva contraseña"
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors"
					/>
				</div>

				<div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
					<button
						type="button"
						onclick={() => closeModals()}
						class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
					>
						Cancelar
					</button>
					<button
						type="submit"
						id="btn-submit-update"
						class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 shadow-sm transition-colors cursor-pointer"
					>
						Guardar Cambios
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
