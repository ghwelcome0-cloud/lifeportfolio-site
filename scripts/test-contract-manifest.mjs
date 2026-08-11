#!/usr/bin/env node
import fs from "node:fs";
import { readBaseManifest, runActiveContracts, validateManifest } from "./contract-manifest-lib.mjs";
const manifestPath = "contracts/activation.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const base = readBaseManifest(process.env.CONTRACT_BASE_SHA, manifestPath);
validateManifest(manifest, base, { currentPr: process.env.CONTRACT_PR_NUMBER });
runActiveContracts(manifest);
console.log("Contract activation manifest passed");
