#!/usr/bin/env node

/**
 * Generates a PR description section showing electron app artifact sizes.
 * Used by the size-compare workflow to add electron sizes to the PR description.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const BYTES_PER_KILOBYTE = 1024;
const FILE_SIZE_DENOMINATIONS = [
  'B',
  'kB',
  'MB',
  'GB',
  'TB',
];

function formatFileSize(bytes) {
  if (bytes == null || Number.isNaN(bytes) || bytes === 0) {
    return '0 B';
  }

  const denominationIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_KILOBYTE)),
    FILE_SIZE_DENOMINATIONS.length - 1,
  );
  const value = bytes / Math.pow(BYTES_PER_KILOBYTE, denominationIndex);

  return `${parseFloat(value.toFixed(2))} ${FILE_SIZE_DENOMINATIONS[denominationIndex]}`;
}

function getIdentifierMarkers(key) {
  const label = 'bundlestats-action-comment';
  return {
    start: `<!--- ${label} key:${key} start --->`,
    end: `<!--- ${label} key:${key} end --->`,
  };
}

function makeHeader(columns) {
  const header = columns.join(' | ');
  const separator = columns
    .map(column =>
      Array.from({ length: column.length })
        .map(() => '-')
        .join(''),
    )
    .join(' | ');

  return `${header}\n${separator}`;
}

function parseArgs(argv) {
  const args = {
    statsDir: null,
    identifier: 'electron-sizes',
    format: 'pr-body',
  };

  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];

    switch (key) {
      case '--stats-dir':
        args.statsDir = value;
        break;
      case '--identifier':
        args.identifier = value;
        break;
      case '--format':
        args.format = value;
        break;
      default:
        throw new Error(`Unknown argument "${key}".`);
    }
  }

  if (!args.statsDir) {
    throw new Error('Missing required argument "--stats-dir".');
  }

  return args;
}

function loadElectronStats(statsDir) {
  if (!existsSync(statsDir)) {
    return [];
  }

  const jsonFiles = readdirSync(statsDir).filter(f => f.endsWith('.json'));
  const allStats = [];

  for (const file of jsonFiles) {
    try {
      const contents = readFileSync(path.join(statsDir, file), 'utf8');
      const parsed = JSON.parse(contents);
      if (Array.isArray(parsed)) {
        allStats.push(...parsed);
      }
    } catch (error) {
      console.error(`[electron-sizes] Failed to parse ${file}: ${error.message}`);
    }
  }

  return allStats.sort((a, b) => a.name.localeCompare(b.name));
}

function generateElectronSizesTable(stats) {
  if (stats.length === 0) {
    return null;
  }

  const headers = makeHeader(['Artifact', 'Size']);
  const rows = stats.map(s => `${s.name} | ${formatFileSize(s.size)}`).join('\n');
  return `${headers}\n${rows}`;
}

function main() {
  const args = parseArgs(process.argv);
  const stats = loadElectronStats(args.statsDir);

  console.error(`[electron-sizes] Found ${stats.length} electron artifacts`);

  const table = generateElectronSizesTable(stats);
  const markers = getIdentifierMarkers(args.identifier);

  if (!table) {
    console.error('[electron-sizes] No electron artifacts found, skipping comment');
    process.stdout.write('');
    return;
  }

  const content = `### Electron App Sizes\n\n${table}`;
  const body = [markers.start, content, '', markers.end, ''].join('\n');

  process.stdout.write(body);
}

main();
