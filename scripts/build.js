#!/usr/bin/env bun
import { mkdir, rm, copyFile, readdir, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";

const args = process.argv.slice(2);
const target =
    args[0] === "prod" || args[0] === "dev"
        ? args[1] || "chrome-mv3"
        : args[0] || "chrome-mv3";

const targets = {
    "chrome-mv3": {
        outDir: ".output/chrome-mv3",
        manifestPath: "manifest.json",
    },
    "firefox-mv3": {
        outDir: ".output/firefox-mv3",
        manifestPath: "manifest.json",
    },
};

const config = targets[target];
if (!config) {
    console.error(`Unknown target: ${target}`);
    process.exit(1);
}

const allowedExtensions = new Set([
    ".json",
    ".js",
    ".css",
    ".html",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".gif",
    ".webp",
    ".ico",
    ".txt",
]);

const excludedDirs = new Set([".git", ".idea", ".output", "node_modules"]);

const excludedFiles = new Set(["package.json", "bun.lock", "bun.lockb"]);

async function collectFiles(dir, rootDir, files) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (excludedDirs.has(entry.name)) continue;
            await collectFiles(join(dir, entry.name), rootDir, files);
            continue;
        }

        const ext = extname(entry.name).toLowerCase();
        if (!allowedExtensions.has(ext)) continue;
        if (excludedFiles.has(entry.name)) continue;

        const fullPath = join(dir, entry.name);
        const relativePath = fullPath.slice(rootDir.length + 1);
        files.push(relativePath);
    }
}

const outDir = config.outDir;
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const rootDir = process.cwd();
const files = [];
await collectFiles(rootDir, rootDir, files);

for (const file of files) {
    const dest = join(outDir, file);
    await mkdir(dirname(dest), { recursive: true });

    await copyFile(file, dest);
}

const manifestDest = join(outDir, config.manifestPath);
const manifestExists = await stat(manifestDest)
    .then(() => true)
    .catch(() => false);
if (!manifestExists) {
    console.error("manifest.json not found in build output.");
    process.exit(1);
}

console.log(`Build complete: ${outDir}`);