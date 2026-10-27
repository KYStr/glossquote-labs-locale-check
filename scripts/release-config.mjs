import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// This candidate follows the reviewed tool 42 assets-only contract. No runtime
// handler, bindings, account identifiers, environment overrides or credentials.
const CONFIG = {
  name: 'glossquote-locale-check',
  compatibility_date: '2026-10-24',
  workers_dev: false,
  preview_urls: false,
  send_metrics: false,
  routes: [{ pattern: 'locale-check.glossquote.com', custom_domain: true }],
  observability: {
    enabled: false,
    logs: { enabled: false, invocation_logs: false },
    traces: { enabled: false },
  },
  assets: {
    directory: './release-artifacts/site',
    run_worker_first: false,
    html_handling: 'none',
    not_found_handling: 'none',
  },
  build: { command: 'node scripts/release.mjs build' },
};
const EXPECTED = Buffer.from(JSON.stringify(CONFIG, null, 2) + '\n');

export async function validateReleaseConfig(root) {
  const path = join(resolve(root), 'wrangler.jsonc');
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size !== EXPECTED.length) throw new Error('RELEASE_CONFIG_INVALID');
  if ((await realpath(path)).toLowerCase() !== resolve(path).toLowerCase()) throw new Error('RELEASE_CONFIG_INDIRECT');
  // Lock every byte as well as values: duplicate/unknown JSON keys, extra
  // sections and implicit configuration overrides cannot be silently accepted.
  if (!(await readFile(path)).equals(EXPECTED)) throw new Error('RELEASE_CONFIG_MISMATCH');
}
