#!/usr/bin/env bun
import { rm } from "node:fs/promises";

await rm(".output", { recursive: true, force: true });
console.log("Cleaned .output");
