#!/usr/bin/env node
import {execFileSync} from "node:child_process";import {routeLegalL0} from "./legal-l0-router-lib.mjs";
const base=process.env.CONTRACT_BASE_SHA,head=process.env.PR_HEAD_SHA||process.env.GITHUB_SHA||execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),pr=Number(process.env.CONTRACT_PR_NUMBER),result=routeLegalL0({baseSha:base,headSha:head,prNumber:pr});console.log(`Legal L0 current PR router: ${result} base=${base} head=${head} pr=${pr}`);
