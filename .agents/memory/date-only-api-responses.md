---
name: Date-only API responses
description: Preserve meal-date strings across response validation and JSON serialization.
---

For date-only values consumed by date navigation, validate the YYYY-MM-DD string without applying a date-time coercion in generated response schemas.

**Why:** The OpenAPI date format generated a coercing Zod schema that turned a database date string into a JavaScript Date. JSON serialization then emitted a timestamp, which was invalid for the date-only feedback endpoint and screen navigation.

**How to apply:** When introducing date-only response fields, inspect the generated response parser and test the serialized wire value. Keep the API and client in agreement on YYYY-MM-DD rather than relying only on TypeScript checks.