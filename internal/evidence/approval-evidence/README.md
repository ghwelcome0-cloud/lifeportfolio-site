# Approval evidence candidates

Initial activation is pending and has no approval record. Future records become trusted only after the activation router verifies their immutable GitHub review/message provenance, expected actor identity, role, decision, time, exact PR/head and source-content hash. Repository-authored actor strings alone never establish approval. Owner and independent-reviewer IDs must differ and may never be reused.

The current GitHub account model has one owner and no allowed independent GitHub reviewer, so ordinary migration approval is intentionally impossible. A future one-person exception requires a separately versioned, scoped and expiring record combining owner approval with immutable independent agent-review evidence. The exception is currently disabled.
