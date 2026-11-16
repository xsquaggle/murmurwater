import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * `virtual:model-list` and `virtual:audio-list`: the model and sound files that are in public/ when the game is
 * built, as paths from public/. The loaders ask only for these where a file has been ordered and may not be
 * delivered yet, so it costs no failed request, and is used from the first build after it lands.
 */
function assetLists(): Plugin {
  const lists: Record<string, [string, string]> = { 'virtual:model-list': ['models', '.glb'], 'virtual:audio-list': ['audio', '.ogg'] };
  const walk = (dir: string, ext: string): string[] => readdirSync(new URL(`./public/${dir}`, import.meta.url), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`, ext) : e.name.endsWith(ext) ? [`${dir}/${e.name}`] : []));
  return {
    name: 'asset-lists',
    resolveId: (source) => (source in lists ? '\0' + source : undefined),
    load: (source) => {
      const l = source.startsWith('\0') ? lists[source.slice(1)] : undefined;
      return l ? `export default ${JSON.stringify(walk(l[0], l[1]).sort())};` : undefined;
    },
  };
}

export default defineConfig({
  plugins: [assetLists()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist', target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
