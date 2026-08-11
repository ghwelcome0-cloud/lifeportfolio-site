"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails, assertSucceeds, initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { get, ref, set, update } = require("firebase/database");

const PROJECT_ID = "demo-lifeportfolio";
const RULES = fs.readFileSync(path.join(__dirname, "..", "..", "database.rules.json"), "utf8");

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules: RULES, host: "127.0.0.1", port: 9000 },
  });

  try {
    const alice = testEnv.authenticatedContext("alice").database();
    const bob = testEnv.authenticatedContext("bob").database();
    const guest = testEnv.unauthenticatedContext().database();

    await assertFails(set(ref(alice, "payments/alice"), {
      paid: true, createdAt: "2026-01-01T00:00:00.000Z", source: "client",
    }));
    await assertFails(update(ref(alice, "payments/alice"), { paid: true }));
    await assertFails(set(ref(alice, "payments/alice/_pending"), { provider: "paypal" }));

    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await set(ref(admin.database(), "payments/alice"), {
        paid: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        source: "server-test",
        provider: "payple",
      });
    });

    const ownPayment = await assertSucceeds(get(ref(alice, "payments/alice")));
    if (!ownPayment.exists() || ownPayment.val().paid !== true) {
      throw new Error("Existing paid user must retain read access");
    }
    await assertFails(get(ref(bob, "payments/alice")));
    await assertFails(get(ref(guest, "payments/alice")));
    await assertFails(update(ref(alice, "payments/alice"), { source: "tampered" }));

    // Additional-payment tokens remain server-owned while paid users keep read access.
    await assertFails(set(ref(alice, "additionalPayments/alice/client-token"), {
      status: "unused", createdAt: 1767225600000,
    }));
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await set(ref(admin.database(), "additionalPayments/alice/server-token"), {
        status: "unused", provider: "paypal", createdAt: 1767225600000,
      });
    });
    const ownAdditional = await assertSucceeds(get(ref(alice, "additionalPayments/alice/server-token")));
    if (!ownAdditional.exists()) throw new Error("Paid user must retain additional-payment read access");
    await assertFails(get(ref(bob, "additionalPayments/alice/server-token")));

    console.log("Payment authority Rules Emulator tests passed");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
