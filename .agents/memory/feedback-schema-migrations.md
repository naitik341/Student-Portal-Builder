---
name: Feedback schema migrations
description: Why feedback schema changes need a checked-in migration even when the development database already has them.
---

Keep the checked-in Drizzle migration history aligned with the schema definition, and verify a clean migration replay in an isolated empty schema. When an existing development database was previously pushed ahead of migration history, use idempotent additions for that transitional migration.

**Why:** The running development database already had feedback identity columns and uniqueness constraints, so integration tests passed there, but a database built from the checked-in migration could not support those same tests.

**How to apply:** For feedback schema changes, compare migration history with the declared schema and test fresh replay as well as the existing development database. Do not infer reproducibility from a passing test against the long-lived development database alone.