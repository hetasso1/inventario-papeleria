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

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
	<!-- Header -->
	<div class="max-w-6xl mx-auto">
		<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
			<div>
				<h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">
					Gestión de Usuarios
				</h1>
				<p class="text-slate-400 mt-1">Administrar usuarios Cajero del sistema</p>
			</div>
			<button
				id="btn-create-user"
				onclick={() => { showCreateModal = true; }}
				class="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500
				       text-white font-semibold rounded-lg shadow-lg shadow-emerald-900/30
				       transition-all duration-200 hover:shadow-emerald-800/40 hover:scale-[1.02]
				       active:scale-95"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<line x1="19" y1="8" x2="19" y2="14"/>
					<line x1="22" y1="11" x2="16" y2="11"/>
				</svg>
				Crear Cajero
			</button>
		</div>

		<!-- Feedback Banner -->
		{#if feedbackMessage}
			<div
				class="mb-6 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300
				       {feedbackType === 'success'
					       ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
					       : 'bg-red-500/20 text-red-300 border border-red-500/30'}"
				id="feedback-banner"
			>
				{feedbackMessage}
			</div>
		{/if}

		<!-- Error from load -->
		{#if (data as any).error}
			<div class="mb-6 px-4 py-3 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-sm">
				{(data as any).error}
			</div>
		{/if}

		<!-- Users Table -->
		<div class="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-left" id="users-table">
					<thead>
						<tr class="bg-slate-700/40 border-b border-slate-600/50">
							<th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuario</th>
							<th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre</th>
							<th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol</th>
							<th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
							<th class="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-700/30">
						{#each data.users as user (user.id)}
							<tr class="hover:bg-slate-700/20 transition-colors duration-150" data-user-id={user.id}>
								<td class="px-4 py-3">
									<div class="flex items-center gap-3">
										<div class="w-9 h-9 rounded-full bg-gradient-to-br
										            {user.role === 'admin' ? 'from-amber-500 to-orange-600' : 'from-blue-500 to-cyan-600'}
										            flex items-center justify-center text-white font-bold text-sm shadow-lg">
											{(user.display_name || user.username || '?')[0].toUpperCase()}
										</div>
										<div>
											<span class="text-white font-medium text-sm">{user.username}</span>
											<p class="text-slate-500 text-xs">{user.email}</p>
										</div>
									</div>
								</td>
								<td class="px-4 py-3 text-slate-300 text-sm">{user.display_name}</td>
								<td class="px-4 py-3">
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
									             {user.role === 'admin'
										             ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
										             : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
										{user.role === 'admin' ? 'Admin' : 'Cajero'}
									</span>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
									             {user.is_active
										             ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
										             : 'bg-red-500/20 text-red-300 border border-red-500/30'}">
										<span class="w-1.5 h-1.5 rounded-full {user.is_active ? 'bg-emerald-400' : 'bg-red-400'}"></span>
										{user.is_active ? 'Activo' : 'Inactivo'}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-2">
										<button
											onclick={() => openEdit(user)}
											class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600/50 rounded-md transition-colors"
											title="Editar usuario"
											aria-label="Editar {user.username}"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
												stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
												<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
											</svg>
										</button>
										{#if user.role !== 'admin'}
											<form method="POST" action="?/toggle" use:enhance>
												<input type="hidden" name="user_id" value={user.id} />
												<input type="hidden" name="activate" value={user.is_active ? 'false' : 'true'} />
												<button
													type="submit"
													class="p-1.5 rounded-md transition-colors
													       {user.is_active
														       ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
														       : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20'}"
													title={user.is_active ? 'Desactivar usuario' : 'Reactivar usuario'}
													aria-label={user.is_active ? `Desactivar ${user.username}` : `Reactivar ${user.username}`}
												>
													{#if user.is_active}
														<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
															stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
															<circle cx="12" cy="12" r="10"/>
															<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
														</svg>
													{:else}
														<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none"
															stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
															<polyline points="20 6 9 17 4 12"/>
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
		<div class="mt-4 text-sm text-slate-500">
			{data.users.length} usuario{data.users.length !== 1 ? 's' : ''} registrado{data.users.length !== 1 ? 's' : ''}
			·
			{data.users.filter((u: any) => u.is_active).length} activo{data.users.filter((u: any) => u.is_active).length !== 1 ? 's' : ''}
		</div>
	</div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
	     onclick={(e) => { if (e.target === e.currentTarget) closeModals(); }}
	     role="dialog"
	     aria-modal="true"
	     aria-label="Crear nuevo usuario"
	>
		<div class="bg-slate-800 rounded-xl border border-slate-700/50 shadow-2xl w-full max-w-md mx-4 p-6">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-lg font-bold text-white">Crear Nuevo Cajero</h3>
				<button
					onclick={() => closeModals()}
					class="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-700/50 transition-colors"
					aria-label="Cerrar"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none"
						stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>

			<form method="POST" action="?/create" use:enhance class="space-y-4">
				<div>
					<label for="create-username" class="block text-sm font-medium text-slate-300 mb-1">Usuario</label>
					<input
						type="text" id="create-username" name="username" required minlength="3"
						placeholder="ej: daniel"
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50
						       focus:border-emerald-500/50 transition-all"
					/>
				</div>
				<div>
					<label for="create-display-name" class="block text-sm font-medium text-slate-300 mb-1">Nombre para Mostrar</label>
					<input
						type="text" id="create-display-name" name="display_name" required minlength="2"
						placeholder="ej: Daniel García"
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50
						       focus:border-emerald-500/50 transition-all"
					/>
				</div>
				<div>
					<label for="create-password" class="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
					<input
						type="password" id="create-password" name="password" required minlength="6"
						placeholder="Mínimo 6 caracteres"
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50
						       focus:border-emerald-500/50 transition-all"
					/>
				</div>
				<div>
					<label for="create-confirm-password" class="block text-sm font-medium text-slate-300 mb-1">Confirmar Contraseña</label>
					<input
						type="password" id="create-confirm-password" name="confirm_password" required minlength="6"
						placeholder="Repetir contraseña"
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50
						       focus:border-emerald-500/50 transition-all"
					/>
				</div>

				<div class="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
					<p class="text-xs text-blue-300">
						<strong>Rol fijo:</strong> Cajero — El rol de Administrador no puede asignarse desde esta interfaz.
					</p>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => closeModals()}
						class="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
					>
						Cancelar
					</button>
					<button
						type="submit"
						id="btn-submit-create"
						class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg
						       shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 text-sm"
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
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
	     onclick={(e) => { if (e.target === e.currentTarget) closeModals(); }}
	     role="dialog"
	     aria-modal="true"
	     aria-label="Editar usuario"
	>
		<div class="bg-slate-800 rounded-xl border border-slate-700/50 shadow-2xl w-full max-w-md mx-4 p-6">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-lg font-bold text-white">Editar Usuario: {editingUser.username}</h3>
				<button
					onclick={() => closeModals()}
					class="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-700/50 transition-colors"
					aria-label="Cerrar"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none"
						stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>

			<form method="POST" action="?/update" use:enhance class="space-y-4">
				<input type="hidden" name="user_id" value={editingUser.id} />
				<div>
					<label for="edit-username" class="block text-sm font-medium text-slate-300 mb-1">Usuario</label>
					<input
						type="text" id="edit-username" name="username" required minlength="3"
						value={editingUser.username}
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
					/>
				</div>
				<div>
					<label for="edit-display-name" class="block text-sm font-medium text-slate-300 mb-1">Nombre para Mostrar</label>
					<input
						type="text" id="edit-display-name" name="display_name" required minlength="2"
						value={editingUser.display_name}
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
					/>
				</div>
				<div>
					<label for="edit-new-password" class="block text-sm font-medium text-slate-300 mb-1">
						Nueva Contraseña <span class="text-slate-500">(dejar vacío para no cambiar)</span>
					</label>
					<input
						type="password" id="edit-new-password" name="new_password" minlength="6"
						placeholder="Mínimo 6 caracteres"
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
						       focus:border-blue-500/50 transition-all"
					/>
				</div>
				<div>
					<label for="edit-confirm-password" class="block text-sm font-medium text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
					<input
						type="password" id="edit-confirm-password" name="confirm_password"
						placeholder="Repetir nueva contraseña"
						class="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white
						       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
						       focus:border-blue-500/50 transition-all"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => closeModals()}
						class="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
					>
						Cancelar
					</button>
					<button
						type="submit"
						id="btn-submit-update"
						class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg
						       shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 text-sm"
					>
						Guardar Cambios
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
