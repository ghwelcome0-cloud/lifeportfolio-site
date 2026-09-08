# T - Gate residual-defect fix design (order T, task #51)

- Agent: code reviewer (the same agent whose order-N audit found our false green lights)
- Collected: 2026-09-08
- **NO ATTACHMENT.** Arrived as 3 body messages, 15771 chars total.
  Fifth body-only reply (J, L, N, R before it). Attachment-only sweep would have lost it.

## Why this reply is unusual

T does not present a clean design. It presents **its own design and then attacks it**,
opening with a `## Critical` section that faults the very document it authored
(`T_게이트잔여결함_수정설계.md:603-608` etc.).
Read it as a defect list against a draft we do not otherwise possess:
the referenced `T_게이트잔여결함_수정설계.md` was **never attached**, so the numbered
critiques below are the only surviving record of both the proposal and its rebuttal.
Do NOT implement from this file blindly - the critique implies design content that is absent.
**Action required: re-request the design file itself from the agent.**

Preserved verbatim, in message order, unedited.

---

## Body message 1/3  (comet_message_id=3806085, ts=2026-09-08T05:30:52+00:00, 5073 chars)

(1/3)

## Critical

1. **(e) Hash probe proves load, not consumption** (`T_게이트잔여결함_수정설계.md:603-608,636-638`). Prepending `throw` only proves module evaluation. A gate may load an engine but never use its exports in either hashed product and still satisfy this probe. **Fix:** apply an engine-specific semantic mutation to a known exercised export and require the relevant final report/program hash to change, or instrument that export and require invocation plus output influence. Maintain an exact engine→product/output contract.

2. **(e) The `career-engine.js` sentinel cannot yield the claimed stderr evidence** (`T_...md:603-608`). `program-engine.js:23-26` catches `require("./career-engine.js")` errors and falls back to `CareerEngine=null`; a prepended throw is swallowed. The child may exit 0, and stderr will not contain the sentinel. **Fix:** mutate a CareerEngine return value exercised by the synthetic fixture and assert the program hash changes; do not use a module-load throw for this engine.

3. **(e) Failure-output parsing is inconsistent** (`T_...md:603-608,625`). The current hash gate emits failure JSON to stderr (`determinism_hash_gate.js:138-152`), but `parseLastJson(child)` is evaluated before `evidence(...)` and appears to parse stdout. On the intended failure path stdout is empty, so parsing fails before marker evaluation. **Fix:** define one schema-validated JSON protocol for pass and fail, preferably exactly one stdout line; otherwise parse the explicitly selected stream per probe without eagerly parsing an empty stream.

4. **(d) `Date(anyArgument)` remains an evasion** (`T_...md:520-521`). Function-call `Date(0)` ignores its arguments and returns current time, but the design flags only zero-argument `Date()`. **Fix:** reject every call to an unshadowed global `Date`; allow explicit values only for `new Date(value)`.

5. **(d) The replacement API map drops existing Node crypto coverage** (`T_...md:503-511`; current `determinism_random_gate.js:39`). `randomBytes`, `randomInt`, and `randomFillSync` disappear, and `require('node:crypto')`, destructured imports, and `crypto.webcrypto` are unspecified. **Fix:** retain `randomBytes`, `randomInt`, `randomFill`, `randomFillSync`, `randomUUID`, and Web Crypto paths; resolve CommonJS namespace/destructured aliases and `globalThis/window/self.crypto.*`; add exact controls for each binding form.

6. **(f) Requiring `quality-axes-gates` still leaves known checks fail-open** (`T_...md:738`; `quality-axes-gates.yml:81-83,117-118,135-153`). The document mentions only touch/CWV. At `432477c`, security reports failed/high checks but exits 0, and CI runs only `rules:matrix:selftest`, not the operational/static audit. **Fix:** enumerate every non-enforcing step; add fail-closed touch/CWV verifiers, make security findings nonzero, and execute the real rules audit/emulator contract. Do not call the workflow a complete required quality gate before that.

## High

7. **(a) The browser fixture is not the real report surface** (`T_...md:99-149`). It injects a fragment into synthetic markup, overrides `.page`, and omits actual report CSS, real `page()` wrapper (`report.html:6293-6298`), book container, pagination, and navigation. This can hide the exact layout defects being targeted. **Fix:** run the real `bookRenderScript()` in a browser with actual report CSS/DOM, then select the section mapped by `_pageMap.ch9`; ideally serve the repository over local HTTP. If fragment-only inspection remains, narrow all claims to fragment-local visibility.

8. **(a) Off-screen content is claimed as detected but passes** (`T_...md:36,121-131`). Positive width/height does not reject translated-offscreen, clipped, or covered content. **Fix:** intersect each required text `Range.getClientRects()` with the page/print content box, account for clipping ancestors, and add offscreen/clipped controls. Add occlusion checks or remove occlusion/user-visible claims.

9. **(a) Parent boxes are used as proxies for text visibility** (`T_...md:121-138`). A parent can have a positive rect while its text is zero-sized, clipped, or displaced. **Fix:** measure the text node through a `Range`, requiring at least one nonzero rect within the allowed page region, while checking ancestor styles/clipping.

10. **(a) Runhead visibility is not tested** (`T_...md:115-143`). The synthetic `#runhead` sits outside `section.page`; `pageVisible` and `visibleText` exclude it. Only argument equality is tested, so a hidden runhead passes. **Fix:** reproduce the real `.page__runhead` inside the section and assert its exact text and computed visibility/rect.

11. **(b) `pages=999` is not rejected by the proposed validator** (`T_...md:239-245,253,319-324,336`). Any positive safe integer passes if pageCount values fit, especially without a baseline. **Fix:** bind pages to an independently discovered target set/count and store its fingerprint in both current and baseline. Otherwise remove the standalone `pages=999` failure claim and require a valid baseline with a different page count in that test.

---

## Body message 2/3  (comet_message_id=3806095, ts=2026-09-08T05:31:06+00:00, 5072 chars)

(2/3)

12. **(b) The schema breaks the checked-in baseline without a migration** (`T_...md:266,304-306`; `docs/measurements/baseline.json:1-30`). The baseline has no `schemaVersion`/`sourceSha`, uses `sourceCommit`, and carries additional provenance fields. Applying the validator makes the required delta step fail immediately. **Fix:** include an explicit baseline JSON migration diff, define exact allowed/required root keys, intentionally preserve provenance, and add a clean migrated-baseline regression test.

13. **(b) Promised checks are missing from the concrete validator** (`T_...md:241-243,246-268,295-315`). `warnings` is never populated; `note`, `sourceSha`, timestamp and SHA mismatch are unchecked; missing/non-array `missing` passes; page equality exists only in prose. **Fix:** implement every listed rule, including exact `missing: []`, SHA/timestamp validation, baseline-current page equality, and root-key policy, with a named control for each.

14. **(b) The fixture CLI is underspecified and unsafe** (`T_...md:319-328`). No parser, containment check, loading contract, or module isolation is given. Lexical repo-relative checks are symlink-escapable, and executing `.mjs` fixtures permits arbitrary code. **Fix:** use JSON fixtures plus direct unit injection for `NaN`/`Infinity`; enforce `realpath` containment under a fixed fixture directory; specify exact CLI/error behavior.

15. **(c) Process isolation leaves a larger false green intact** (`T_...md:352-455`; `determinism_hash_gate.js:20,55-68`). The gate recursively strips every field named `generatedAt`, `publishedAt`, or `submittedAt`. Independent processes can produce different user-visible timestamp fields and still hash equal. Current engines call `new Date()` (`report-engine.js:1867`, `report-engine-v4.js:9379`, `program-engine.js:1271,2899`). **Fix:** inject a fixed clock and hash complete output, or exclude only exact documented JSON pointers proven non-user-visible. Add a nested semantic timestamp-key mutation that must fail.

16. **(c) Second-worker mutation is not actually wired in the shown parent** (`T_...md:385-435`). `worker()` reacts to inherited `LP_HASH_GATE_MUTATE`, but the shown parent calls `spawnWorker()` twice with no second-only env. **Fix:** show a dedicated parent negative-control invocation using a clean first worker and `spawnWorker({LP_HASH_GATE_MUTATE:'1'})` for only the second; sanitize control env vars in ordinary runs so ambient CI variables cannot mutate both.

17. **(d) Alias/scope semantics are too incomplete for a safe implementation** (`T_...md:514-523`). Assignment aliases, invalidation/reassignment, nested scopes, destructuring assignment, global-object normalization, and `.call/.apply/.bind` are omitted. The required `globalThis.crypto.randomUUID()` case is not derivable from the listed rules. **Fix:** specify symbol-table transfer/invalidation rules or adopt a conservative syntactic policy and document false positives. Add controls for reassignment, nested shadowing, `.call/.apply`, `const c=globalThis.crypto`, and destructured CommonJS crypto.

18. **(e) A generic phantom engine cannot be required to affect product output** (`T_...md:662,669`). A new empty filename-matching module has no product entrypoint. Requiring both gates to “consume” it conflates discovery, loading, and semantic participation. **Fix:** define an explicit registry with each engine’s entrypoint, exercised export, and affected output. Require discovered set = registry set, then behavioral evidence per registry entry. An unregistered phantom should fail registry coverage, not be forcibly consumed.

## Medium

19. **The explicit `[추정]` requirement is unmet.** The document contains zero `[추정]` labels. Unexecuted browser, AST, worktree, and ruleset-behavior claims are categorical. **Fix:** label every unverified behavioral assertion `[추정]`; retain measured repository/API facts as facts.

20. **“Concrete diff” is only partially satisfied.** Sections (a)-(e) contain ellipses and undefined helpers: `stripMarkupNeedle`, `replaceExactlyOnce`, `createDetachedWorktreeInsideRepo`, `removeWorktree`, `parseLastJson`, `readHeadSha`, and `fail`; CLI/main/self-test rewiring is omitted. **Fix:** provide complete unified patches or complete replacement functions including imports, exports, parser, cleanup, protocol, and package/workflow edits.

21. **(a) `display_none_panel` creates malformed HTML** (`T_...md:192-196`). It inserts an opening `<div>` without a close, so parser recovery confounds the visibility test. **Fix:** replace a complete stable block with a balanced wrapper or add style/class to an existing container; assert exactly one replacement and the exact failed key.

22. **(b) Atomic replacement lacks cleanup/durability detail** (`T_...md:307-312`). Failed rename leaves `.tmp-<pid>`; PID reuse can then fail `wx`. Rename gives atomic visibility, not guaranteed crash durability. **Fix:** use `try/finally`, unlink temp on failure, fsync file and parent where supported, or qualify the promise as atomic visibility only.

---

## Body message 3/3  (comet_message_id=3806110, ts=2026-09-08T05:31:28+00:00, 5626 chars)

(3/3)

23. **(e) `.gate-work/` is not currently ignored** (`T_...md:455,616,639`; `.gitignore`). The prose says to register it but gives no diff; interrupted probes can leave an untracked/registered worktree. **Fix:** include `/.gate-work/`, unique paths, `finally` removal plus `git worktree prune`, and a post-test assertion that no probe worktree/path remains.

24. **(f) The rollout order can deadlock merges** (`T_...md:16,730-736`). It recommends immediate/parallel required registration before the fixes and before observing actual check runs. Current main is `b03e2190`; its check runs do not show either proposed context, and the workflow files are absent from main. **Fix:** first land/validate workflows on a temporary PR and capture exact check-run names/app IDs; only then perform full GET-modify-PUT, with rollback prepared, followed immediately by good/failing/missing-check PR tests.

25. **(f) “exactly four contexts” is unsafe under concurrent changes** (`T_...md:733-735,749`). It can reject or overwrite another legitimate check added between reads. **Fix:** assert both new contexts are present and every pre-change context remains unchanged; compare to a captured pre-change snapshot instead of hard-coding cardinality four.

26. **Required-check identity is still spoofable by another Actions workflow** (`T_...md:701-713`). `integration_id:15368` binds GitHub Actions, not one workflow file. **Fix:** protect workflow bytes through the trusted governance contract and reject duplicate job/check names and trigger weakening. Prefer GitHub required-workflow binding if available.

27. **The P0 ordering overstates (f)’s value** (`T_...md:9-16`). Requiring an incomplete/fail-open job either preserves false greens or risks lockout; it does not make underlying checks sound. **Fix:** classify (f) as coordinated P0 activation dependent on clean preflight and fail-closed gate fixes, not an unconditional parallel first action.

28. **The final “not verified” list omits material uncertainties** (`T_...md:794-802`). Missing disclosures include fragment-vs-real-report rendering, global timestamp-key stripping, swallowed CareerEngine sentinel, baseline migration, and other fail-open quality steps. **Fix:** add these explicitly as blocking/unverified items.

29. **(a) The requirement name is overstated** (`T_...md:20,174-179`). Even after the proposed patch, `report_ch9_render_gate` does not prove navigation/TOC/page numbering/print/PDF “actual surface”; item 2 later admits this. **Fix:** rename the completion criterion and output to “captured CH9 fragment metadata and local visibility,” or extend the test to the real viewer before retaining “actual surface.”

30. **(b) `sourceSha` warning is conceptually wrong for a historical baseline** (`T_...md:242`). A baseline SHA should normally differ from current SHA; warning on every expected comparison creates permanent noise. **Fix:** validate SHA shape and source existence/reachability, record current source separately, and warn only for an unknown/unresolvable baseline source or incompatible target fingerprint.

31. **(d) `eval`/`Function` blanket rejection is not scoped to actual evasion** (`T_...md:522`). Rejecting every use can create unrelated false positives, while aliases such as `const F=Function; F(...)` remain unspecified. **Fix:** either state and enforce a simple explicit policy banning all unshadowed dynamic-code constructors with alias tracking, or remove this from the random/clock detector and put it in a separately named policy gate.

32. **(c) Input-change control mutates a shared worktree between workers** (`T_...md:453-455`). That proves the orchestrator notices changed inputs, not process isolation, and concurrent reads can race. **Fix:** give each worker an immutable copied/worktree root with a recorded manifest, deliberately provide different roots for the negative test, and assert an `inputs_changed` verdict deterministically.

33. **(a) Puppeteer launch merging allows required safety/CI options to be silently overridden** (`T_...md:103-109`). Trailing `...launch` can replace `args`, `headless`, or executable path. **Fix:** accept only an explicit executable path or merge args intentionally; do not spread an unrestricted object after required defaults.

34. **(b) `extractRaw()` still accepts finite but invalid values before validation and loses useful type diagnostics** (`T_...md:273-279`). Strings go into `values` and are later reported generically, while `NaN`/Infinity stringify ambiguously. **Fix:** keep `{path, rawType, serializedValue}` in an `invalid` collection and make `validateMeasurement` require `missing=[]` and `invalid=[]`; never serialize non-finite values as ordinary JSON data.

35. **(f) Exact job names are correctly read from detached `432477c`, but not verified at the claimed current main** (`T_...md:681-683,800`). This is an important branch distinction, not merely a minor caveat: GitHub main currently lacks both workflow files/check contexts. **Fix:** state explicitly that names are code-level candidates from descendant commit history, not observed main check contexts, and make successful temporary-PR check runs a hard prerequisite to ruleset mutation.

No file was edited. Repository remained clean at detached `432477c`. I also verified that `3fd99df8c9841a7e7c8714ae5cd2361497dfdf5c` exists locally as a three-commit descendant and that its delta-gate changes match the document’s narrow claims: shared `computeDelta`, default failure on worsened rows, and JSON-path failure. Those fixes do not address the remaining schema/save-order issues listed above.

