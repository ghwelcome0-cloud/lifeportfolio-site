#!/usr/bin/env node
import {routeLegalL0} from "./legal-l0-router-lib.mjs";
console.log(routeLegalL0({baseSha:process.env.CONTRACT_BASE_SHA,headSha:process.env.PR_HEAD_SHA||process.env.GITHUB_SHA,prNumber:process.env.CONTRACT_PR_NUMBER}));
