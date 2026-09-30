---
name: Private feedback pagination
description: Privacy constraint for stable staff feedback pagination
---

Staff feedback pagination must use a deterministic tie-breaker for responses that share the same creation time, but the tie-breaker must never be exposed as a readable identifier. Keep continuation tokens opaque and bound to the requested meal and date.

**Why:** A timestamp-only boundary can skip responses with tied timestamps, while a plain encoded database key exposes a submission identifier to staff clients.

**How to apply:** When changing staff feedback ordering or page tokens, preserve a private tie-breaker and keep the public response limited to the feedback fields and an opaque continuation token.