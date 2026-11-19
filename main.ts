// Neon Tide — make.fun gta6-01 entry program (Node 22, standard library only).
//
// The game itself is the static site under game/ (open game/index.html in a desktop
// browser, offline, no build step). This program is only the courier: it copies
// game/ and screenshots/ next to itself into the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library, so the
// scorer rebuilds the exact same dossier from the exact same files.
//
// Run it the way the grader does, with a stand-in output directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, mirrored so an entry the scorer would refuse is refused
// here first: at most 4 screenshots of at most 256 KiB each, at most 993 files
// and 48 MiB under game/, no game/ path longer than 1000 bytes, and the dossier
// text capped at 160 KiB.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(repoDir, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(outputDir, GATE);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
