#!/usr/bin/env bun
import { readFile, access } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import archiver from "archiver";

const args = process.argv.slice(2);
const target = args[0] || "chrome-mv3";
const outDir =
    target === "firefox-mv3" ? ".output/firefox-mv3" : ".output/chrome-mv3";

await access(outDir).catch(() => {
    console.error(`Build output not found: ${outDir}`);
    process.exit(1);
});

const manifestPath = join(outDir, "manifest.json");
const manifestSource = await readFile(manifestPath, "utf8").catch(() =>
    readFile("manifest.json", "utf8"),
);
const manifest = JSON.parse(manifestSource);
const version = manifest.version || "0.0.0";
const zipName = `extension-${target}-${version}.zip`;
const zipPath = join(outDir, zipName);

const output = createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });

const finalizeZip = new Promise((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
});

archive.pipe(output);
archive.directory(outDir, false, (entry) => {
    if (entry.name === zipName) return false;
    return entry;
});

await archive.finalize();
await finalizeZip;
console.log(`ZIP ready: ${zipPath}`);