# Legal-authority evidence

This directory is physically and logically separate from ROPA/customer-data evidence. Its three layers are `issues[]`, atomic `sources[]`, and many-to-many `issue_authority_links[]`. It may contain only public legal-source metadata, source hashes, short reviewed quotations, scope/limitations, and approval status.

It must never contain customer data, conversation or counselling transcripts, support messages, private legal advice, credentials, private URLs, or production exports. `training_eligibility` defaults to `false` and may change only after source, licence and counsel review.

**Canonical limitation:** CI passing proves structural integrity only; it cannot change approval state and does not establish processing lawfulness, legal analysis approval, counsel approval, publication approval, training approval, or deployment approval.
