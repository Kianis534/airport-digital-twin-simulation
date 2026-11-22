// Post-processing for `next build` with `output: 'export'`.
//
// Next.js 16 writes client-navigation segment data as nested folders, e.g.
//   out/what-if/__next.<segment>/what-if/__PAGE__.txt
// while the router requests a flat file name:
//   out/what-if/__next.<segment>.what-if.__PAGE__.txt
// A Next.js server resolves this itself, but static hosts (GitHub Pages) cannot, so
// each segment file is copied to its flat name as well.
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const outDir = process.argv[2] ?? 'out';
if (!existsSync(outDir)) {
  console.error(`flatten-rsc: ${outDir} not found (run the static build first)`);
  process.exit(1);
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

let copied = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory() || name === '_next') continue;
    if (name.startsWith('__next.')) {
      for (const file of filesUnder(full)) {
        const flat = `${name}.${relative(full, file).split(sep).join('.')}`;
        copyFileSync(file, join(dir, flat));
        copied += 1;
      }
    } else {
      walk(full);
    }
  }
}

walk(outDir);
console.log(`flatten-rsc: wrote ${copied} flat segment files`);
