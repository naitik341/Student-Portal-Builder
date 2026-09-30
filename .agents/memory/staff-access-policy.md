---
name: Staff access policy
description: Why MessMate management access is opt-in even after sign-in.
---

Manager sign-in alone does not grant permission to edit menus or read summaries. Staff access requires an explicitly configured, verified primary email; an empty allowlist must deny access.

**Why:** A public account-creation path cannot safely make the first signer or any self-declared staff member an administrator. The user chose protected staff sign-in rather than an open management screen.

**How to apply:** For new management APIs and screens, enforce authorization on the server and keep the empty-allowlist default deny. Ask for the authorized staff email instead of weakening the check to make testing easier.