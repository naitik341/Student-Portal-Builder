---
name: Expo watcher limits
description: Why Expo previews in this pnpm workspace can fail with ENOSPC despite ample disk space
---

Expo's default Metro configuration can use native filesystem watchers even when Watchman is installed. In a pnpm monorepo, this can fail with `ENOSPC: System limit for number of file watchers reached`; this is not a disk-space problem.

**Why:** Restarting alone recovered the preview temporarily, but the failure recurred. Installing Watchman and explicitly enabling it in Metro allowed the watcher to track the workspace as a single root.

**How to apply:** When an Expo preview reports watcher-limit ENOSPC, verify that Watchman is installed and that Metro is actually using it; a successful `watchman --version` alone does not prove Metro has switched. Check `watchman watch-list` after bundling. Avoid repeatedly restarting the workflow without addressing watcher usage.