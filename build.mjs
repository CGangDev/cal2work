#!/usr/bin/env node
/**
 * Build script for creating standalone executables.
 *
 * Usage:
 *   node build.mjs              — build for all platforms (linux, win, macos)
 *   node build.mjs linux        — build for Linux only
 *   node build.mjs win          — build for Windows only
 *   node build.mjs macos        — build for macOS only
 */
import { execSync } from 'child_process';
import { mkdirSync, cpSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const BUILD_DIR = path.join(ROOT, '.pkg-build');
const RELEASE_DIR = path.join(ROOT, 'release');

const PLATFORM_MAP = {
  linux: 'node22-linux-x64',
  win: 'node22-win-x64',
  macos: 'node22-macos-x64',
};

const requestedPlatform = process.argv[2];
const targets = requestedPlatform
  ? [PLATFORM_MAP[requestedPlatform]].filter(Boolean)
  : Object.values(PLATFORM_MAP);

if (targets.length === 0) {
  console.error(`Unknown platform: ${requestedPlatform}`);
  console.error(`Valid options: ${Object.keys(PLATFORM_MAP).join(', ')}`);
  process.exit(1);
}

function run(cmd, cwd = ROOT) {
  console.log(`  → ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// ── Step 1: Build the frontend ──────────────────────────────────────────────
console.log('\n📦 Building frontend...');
run('npm run build');

// ── Step 2: Prepare a clean build directory ──────────────────────────────────
console.log('\n📁 Preparing production build directory...');

if (existsSync(BUILD_DIR)) rmSync(BUILD_DIR, { recursive: true });
mkdirSync(BUILD_DIR, { recursive: true });

// Bundle server.mjs into a single CJS file (pkg handles CJS reliably)
console.log('  Bundling server code...');
run(`npx esbuild server.mjs --bundle --platform=node --format=cjs --outfile="${path.join(BUILD_DIR, 'server.cjs')}"`);

// Copy built frontend into the build directory (pkg embeds these as assets)
cpSync(path.join(ROOT, 'dist'), path.join(BUILD_DIR, 'dist'), { recursive: true });

// Create a minimal package.json for pkg
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  bin: 'server.cjs',
  pkg: {
    assets: ['dist/**/*'],
    outputPath: RELEASE_DIR,
  },
};
writeFileSync(path.join(BUILD_DIR, 'package.json'), JSON.stringify(prodPkg, null, 2));

// ── Step 3: Package with pkg ─────────────────────────────────────────────────
console.log('\n🔨 Packaging executables...');
if (existsSync(RELEASE_DIR)) rmSync(RELEASE_DIR, { recursive: true });
mkdirSync(RELEASE_DIR, { recursive: true });

const targetStr = targets.join(',');
run(`npx @yao-pkg/pkg . --targets ${targetStr} --output "${path.join(RELEASE_DIR, 'cal2work')}"`, BUILD_DIR);

// ── Step 4: Report results ───────────────────────────────────────────────────
console.log('\n  Output:');
for (const file of readdirSync(RELEASE_DIR)) {
  console.log(`  ✓ ${file}`);
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
console.log('\n🧹 Cleaning up...');
rmSync(BUILD_DIR, { recursive: true });

console.log('\n✅ Done! Single-file executables are in the release/ directory.');
console.log('   Each executable is fully self-contained (no external files needed).\n');
