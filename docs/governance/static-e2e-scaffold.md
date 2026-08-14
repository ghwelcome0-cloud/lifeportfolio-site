# Static E2E scaffold

This is a contract and self-test only. It changes no product/runtime files and contains no write runner.

- Matrix: 1440/320/375/430 × KO/EN = 8 exact projects.
- Network: deny by default; only fixture-local GET/HEAD is permitted.
- Production backend fingerprints fail before static execution.
- Auth/write/payment/PDF/cross-UID suites remain blocked.
- Without verified backend isolation the final status is `FAILED_BLOCKED` and exit code is 1, even if every static case passes.
- Trace/HAR remain off; evidence redaction is mandatory.
