// validate.mjs <model.glb ...> : run the Khronos glTF validator on models and print its counts and messages.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const validator = createRequire(import.meta.url)('gltf-validator');
for (const f of process.argv.slice(2)) {
  const r = await validator.validateBytes(new Uint8Array(fs.readFileSync(f)));
  console.log(f, JSON.stringify({ errors: r.issues.numErrors, warnings: r.issues.numWarnings, infos: r.issues.numInfos, hints: r.issues.numHints }));
  for (const m of r.issues.messages.slice(0, 8)) console.log('  ', m.severity, m.code, m.pointer || '', m.message);
}
