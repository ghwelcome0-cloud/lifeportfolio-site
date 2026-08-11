#!/usr/bin/env node
import { verifyArtifact } from "./hosting-artifact-verifier-lib.mjs";
const result = verifyArtifact(process.argv[2] || "dist");
console.log(`Trusted artifact verification passed: ${result.files} files`);
