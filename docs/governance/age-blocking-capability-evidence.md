# Age blocking capability — read-only evidence

Status: **unverified / runtime absent / release blocked**

- Repository dependency: `firebase-functions` 6.1.0, Node 22.
- Repository blocking imports/exports: none.
- Auth routes requiring future coverage: email/password, Google, Kakao OIDC, B2B, existing-account sign-in.
- An OIDC provider reference does **not** prove Identity Platform blocking-function support.
- The sandbox has no authenticated Firebase project-query evidence, so project tier, blocking support, provider configuration, and deployed blockers remain unknown.

This PoC performs no Firebase mutation, deploy, Functions export, Rules change, user creation, or runtime age enforcement. Capability must remain blocked until authenticated console/API evidence is reviewed.
