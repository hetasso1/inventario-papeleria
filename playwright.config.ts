import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Safely load .env.local if present
if (existsSync(resolve('.env.local'))) {
	try {
		const envContent = readFileSync(resolve('.env.local'), 'utf-8');
		for (const line of envContent.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const idx = trimmed.indexOf('=');
				if (idx !== -1) {
					const key = trimmed.slice(0, idx).trim();
					const val = trimmed.slice(idx + 1).trim();
					if (key && val && !process.env[key]) {
						process.env[key] = val;
					}
				}
			}
		}
	} catch {
		// Ignore read error
	}
}

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
	testDir: './tests/e2e',
	timeout: 90000,
	expect: {
		timeout: 20000
	},
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: 'http://localhost:3000',
		channel: 'chrome',
		headless: true,
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'node build',
		port: 3000,
		timeout: 30000,
		reuseExistingServer: false,
		env: {
			...process.env,
			PORT: '3000',
			ORIGIN: 'http://localhost:3000',
			NODE_ENV: 'production'
		}
	}
};

export default config;
