import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, access } from 'node:fs/promises';
import { join, resolve, basename, extname } from 'node:path';
import { constants } from 'node:fs';

/**
 * Endpoint to serve locally-stored product images at runtime.
 *
 * adapter-node (via sirv) indexes static files at startup and will NOT serve
 * files created dynamically after the process starts. This endpoint bridges
 * that gap by reading directly from the filesystem.
 *
 * Security:
 * - Only serves files from `static/uploads/products/`.
 * - Rejects path traversal attempts.
 * - Only serves files with allowed image extensions.
 * - Returns proper Content-Type headers.
 * - Read-only: only GET is implemented.
 */

const ALLOWED_EXTENSIONS: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml'
};

/** Resolve the base directory for product uploads (works in dev and prod). */
function getUploadsDir(): string {
	// In dev, process.cwd() is project root; in prod (node build), it's also project root.
	// static/ is copied to build/client/ by adapter-node, but runtime uploads go to static/.
	return resolve(process.cwd(), 'static', 'uploads', 'products');
}

export const GET: RequestHandler = async ({ params }) => {
	const { filename } = params;

	// 1. Reject empty or missing filename
	if (!filename || filename.trim() === '') {
		throw error(400, 'Nombre de archivo no especificado.');
	}

	// 2. Extract only the basename to prevent path traversal
	const safeFilename = basename(filename);

	// 3. Reject if basename differs from original (traversal attempt)
	if (safeFilename !== filename) {
		throw error(400, 'Nombre de archivo inválido.');
	}

	// 4. Reject directory traversal patterns
	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		throw error(400, 'Nombre de archivo inválido.');
	}

	// 5. Validate extension is an allowed image type
	const ext = extname(safeFilename).toLowerCase();
	const contentType = ALLOWED_EXTENSIONS[ext];
	if (!contentType) {
		throw error(400, 'Tipo de archivo no soportado.');
	}

	// 6. Resolve full path and verify it stays within the uploads directory
	const uploadsDir = getUploadsDir();
	const filePath = resolve(uploadsDir, safeFilename);

	if (!filePath.startsWith(uploadsDir)) {
		throw error(400, 'Ruta de archivo inválida.');
	}

	// 7. Check file exists
	try {
		await access(filePath, constants.R_OK);
	} catch {
		throw error(404, 'Imagen no encontrada.');
	}

	// 8. Read and serve the file
	const fileBuffer = await readFile(filePath);

	return new Response(fileBuffer, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Content-Length': fileBuffer.length.toString(),
			'Cache-Control': 'public, max-age=86400, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
