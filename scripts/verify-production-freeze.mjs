#!/usr/bin/env node
import {readProductionOpen} from "./production-freeze-lib.mjs";
readProductionOpen({repository:process.env.EXPECTED_REPOSITORY});
console.log("Trusted production freeze is open");
