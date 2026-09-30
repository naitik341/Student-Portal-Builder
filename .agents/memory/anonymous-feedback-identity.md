---
name: Anonymous feedback identity
description: Scope of duplicate protection for anonymous student meal ratings
---

Anonymous ratings use a persisted, random per-installation identifier to enforce one rating per meal per local calendar day. It is not a verified student identity, so the same person can rate from another device or after clearing app storage.

**Why:** Preventing cross-device duplicates requires authentication or another stable identity, which would change the anonymous student experience.

**How to apply:** Describe the limit accurately in product copy and API guarantees. If cross-device uniqueness becomes a requirement, design explicit identity and privacy consent rather than treating the device identifier as a person.