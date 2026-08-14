# Approved migrations

This directory is empty during initial pending activation. Future records require two distinct trusted approval-evidence records and must pass `internal-evidence-migration-lib.mjs` against the exact GitHub PR base, head and number.

Semver rules:
- `metadata_patch`: same major/minor, patch exactly +1.
- `corpus_minor`: same major, minor exactly +1, patch reset to 0.

Major-version jumps are not accepted by this validator and require a new governance design.
