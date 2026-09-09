# tl-r11-g10-stuck-key — options + test specification for the "stuck key" (G10 remainder)

Scenario (X 3827817 / owner 3868585): publish transport fails after the fence → lock `complete@n` + staging
present, public docs absent → the customer permanently changes `responses/{uid}/{sid}` (or the entitlement
evidence changes). Every later call for the same idempotency key (uid, sid, targetBundle, consentEventId) goes
`settleComplete → publishFromStaging → SESSION_CHANGED` (or `ENTITLEMENT_REVOKED`). Nothing is published, the
saved legacy report keeps serving, `readInstancePair` of other instances works. **Correct and safe — but the key
never completes.** Current module behaviour (9f2c3f9) is unchanged by this document.

Owner decision state (3871771, Q90-R12): **policy A (status quo) stays in force. B+C are under review. No core
change is approved** — the `planGeneration` rule described under B is a proposal only and must not be implemented
until the owner approves it in writing.

Constraints (owner 3868585 / 3870579): no automatic lock-TTL reset, no answer restore, no entitlement
consumption, no recomputation of an existing instance, saved-read stays independent, core index.js is
owner-owned — so every option below is a **new** explicit action, never a reinterpretation of the stuck attempt.

## Options

| # | option | what changes | who decides | pros | cons / risks |
|---|---|---|---|---|---|
| A | **Do nothing** (status quo) | — | owner | zero risk; already fail-closed | customer cannot obtain the instance for that (sid, bundle) until an operator acts; key stuck forever |
| B | **Explicit new generation under a new consent event** | Client records a *new* consent (`recordConsent` → new `consentEventId`) and calls generate with it. Because `idempotencyKey = sha256(uid|sid|targetBundle|consentEventId)`, this is a **different key**: fresh lock, fresh plan from the *current* responses, fresh instance. Stuck key stays as is (audit). | owner (policy: is a new consent an acceptable trigger for same-bundle re-generation? today same-bundle generation has `consentEventId=null` and `planGeneration` rejects a consentEventId when `upgrade=false` → needs a core rule change: allow an explicit "regenerate" consent for non-upgrade) | no module state mutation; uses existing fencing; customer-driven, auditable via consent record; no operator | requires core change in `planGeneration` (owner) + a `disclosureVersion` for "regenerate after answer change"; creates a second instance for the same sid (allowed — instances are immutable and listed by createdAt); entitlement is re-resolved, not consumed |
| C | **Operator exception grant** | Admin-only writer records `q90Entitlements/{uid}` (`source:"admin:manual-grant"`, `evidenceRef: ticket`) and/or a new consent on the customer's behalf **with the customer's recorded request**; then B applies. | owner + legal gate (R10) | covers customers who cannot self-serve; auditable | needs the writer (not built), operator tooling, policy text |
| D | **Staging expiry sweep (admin job)** | Scheduled/admin job lists `generationStaging/{lockKey}/*` older than N days whose lock is `complete` and docs absent, and *marks* them (`state:"abandoned"` on staging, lock untouched) | owner | keeps the tree from growing; reporting | still no publication; touches server-only nodes; must never delete a lock or reopen it — this is bookkeeping only. Not recommended before B/C exist |

Recommendation (TL): **B as the product path, C as the exception path, A until B's core rule is approved; D not
now.** B keeps every invariant already proven (fencing, immutable instances, snapshot hash, evidence hash) and
turns the stuck key into an auditable dead attempt instead of a special case.

Required core change for B (owner-owned; NOT written here): in `planGeneration`, accept `consentEventId` when
`upgrade === false` **iff** the consent record has `disclosureVersion === "q90-regenerate-v1"` (new whitelisted
value), `targetBundle === originBundle || legacy absent`, and `priorInstanceId` names an existing instance or
null. Everything downstream is unchanged. Adapter/group-module need no change (body already carries
`consentEventId?`); `KNOWN_DISCLOSURES` gains one entry.

## Test specification (to be implemented once the owner picks an option)

Unit (fake DB) — all must hold **before** and **after**:
- T1 stuck key reproduces: transport failure in publish → lock complete + staging; change Q3 → 3 retries all
  `SESSION_CHANGED`; docs absent; lock/staging bytes unchanged; `readInstancePair` of another instance OK.
- T2 (B) new consent `q90-regenerate-v1` → new key ≠ stuck key; generate publishes ONE new pair from *current*
  responses (`inputSnapshotHash` = hash of current node); stuck key's lock/staging untouched; legacy
  `reports/` untouched; `reportInstances/{uid}/{sid}` now has exactly one new instance.
- T3 (B negative) same-bundle generate with a consent whose disclosure is `q90-disclosure-v1` (upgrade-only) →
  `INVALID_REQUEST`; consent for another sid/bundle → `EXPLICIT_UPGRADE_CONSENT_REQUIRED`/`INVALID_REQUEST`;
  consent record missing → rejected; body without consent still hits the stuck key → `SESSION_CHANGED`.
- T4 no bypass: with option B enabled, TTL passing does **not** reopen the stuck key (still complete →
  `SESSION_CHANGED`); no code path writes `responses/`, `payments/`, `additionalPayments/`, or an existing
  instance; entitlement is re-resolved (must still hold) but never written.
- T5 adapter: the new flow is the existing callables only (`q90RecordConsent` → `q90GenerateInstancePair`);
  error mapping unchanged; details leak-free; feature OFF blocks it; read unaffected.
- T6 (D, if ever) sweep marks only `staging` entries whose lock is `complete` AND docs absent AND age > N;
  never touches locks, docs, or staging of `pending` attempts; idempotent.

Real SDK (emulator, cold, X): R-T1 stuck reproduction on the real RTDB; R-T2 new-consent generation publishes
exactly one pair and the stuck lock is byte-identical before/after; R-T4 TTL elapsed → still `SESSION_CHANGED`.

Exit criteria for closing the G10 stuck-key item: owner selects A/B/C(+D); if B/C, core rule PR merged (owner),
T1–T5 green on fake DB, R-T1/2/4 green on the emulator, API-CONTRACT §1 error table + §7 updated, X sign-off.
