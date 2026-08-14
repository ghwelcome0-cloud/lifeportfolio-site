# Unsupported future migrations

This directory must remain empty. Protected corpus/status changes are
`unsupported_until_external_verifier` and the activation router rejects them
unconditionally. External current approval plus a post-merge historical seal
is a follow-up design, not a capability implemented by this PR.

No migration or approval record in this directory can authorize retrieval,
external Q&A, publication, training, legal approval, or deployment.

Operational cost: corpus corrections are unavailable after activation. This is
`High / Accepted temporarily` containment, not a complete migration system.
