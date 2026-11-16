/** Injected by Vite from package.json (see vite.config.ts). */
declare const __APP_VERSION__: string;

/** The .glb files in public/models at build time, as paths from public/ (see vite.config.ts). */
declare module 'virtual:model-list' { const files: string[]; export default files; }
declare module 'virtual:audio-list' { const files: string[]; export default files; }
