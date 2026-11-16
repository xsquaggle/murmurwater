import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * `virtual:model-list`: the model files that are in public/models when the game is built, as paths from public/.
 * The loader asks only for these, so a model that has been ordered and not delivered costs no failed request.
 */
function modelList(): Plugin {
  const id = 'virtual:model-list', resolved = '\0' + id;
  const walk = (dir: string): string[] => readdirSync(new URL(`./public/${dir}`, import.meta.url), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.glb') ? [`${dir}/${e.name}`] : []));
  return {
    name: 'model-list',
    resolveId: (source) => (source === id ? resolved : undefined),
    load: (source) => (source === resolved ? `export default ${JSON.stringify(walk('models').sort())};` : undefined),
  };
}

export default defineConfig({
  plugins: [modelList()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist', target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
