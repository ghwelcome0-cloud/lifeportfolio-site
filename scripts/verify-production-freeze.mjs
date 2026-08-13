#!/usr/bin/env node
import {readProductionFreeze,requireProductionOpen} from "./production-freeze-lib.mjs";
requireProductionOpen(readProductionFreeze());
