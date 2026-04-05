#!/usr/bin/env bun
import { watch } from "node:fs";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const target = args[0] || "chrome-mv3";

let running = false;
let pending = false;

const run = () => {
    if (running) {
        pending = true;
        return;
    }

    running = true;
    const p = spawn("bun", ["run", "build:dev", "--", target], {
        stdio: "inherit",
    });
    p.on("exit", () => {
        running = false;
        if (pending) {
            pending = false;
            run();
        }
    });
};

run();

const watcher = watch(
    process.cwd(),
    { recursive: true },
    (_event, filename) => {
        if (!filename) return;
        if (
            filename.startsWith(".git") ||
            filename.startsWith(".idea") ||
            filename.startsWith(".output") ||
            filename.startsWith("node_modules")
        ) {
            return;
        }

        run();
    },
);

process.on("SIGINT", () => {
    watcher.close();
    process.exit(0);
});