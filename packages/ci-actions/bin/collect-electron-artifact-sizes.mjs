#!/usr/bin/env node

/**
 * Collects the sizes of electron build artifacts and writes them to a JSON file.
 * Used by the electron-pr.yml workflow to generate stats for the size-compare workflow.
 */

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ELECTRON_EXTENSIONS = ['.AppImage', '.flatpak', '.exe', '.dmg'];

function parseArgs(argv) {
  const args = { distDir: 'packages/desktop-electron/dist', output: 'electron-stats.json' };

  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];

    switch (key) {
      case '--dist':
        args.distDir = value;
        break;
      case '--output':
        args.output = value;
        break;
      default:
        throw new Error(`Unknown argument "${key}".`);
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const distDir = args.distDir;
  const output = args.output;

  if (!existsSync(distDir)) {
    console.error(`[electron-stats] Dist directory not found: ${distDir}`);
    writeFileSync(output, '[]');
    return;
  }

  const files = readdirSync(distDir).filter(f =>
    ELECTRON_EXTENSIONS.some(ext => f.endsWith(ext)),
  );

  const stats = files.map(f => ({
    name: f,
    size: statSync(path.join(distDir, f)).size,
  }));

  writeFileSync(output, JSON.stringify(stats, null, 2));
  console.error(`[electron-stats] Collected ${stats.length} artifacts`);
  for (const s of stats) {
    console.error(`  ${s.name}: ${s.size} bytes`);
  }
}

main();
