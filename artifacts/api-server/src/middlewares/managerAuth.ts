import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireManager: RequestHandler = async (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const allowlist = (process.env.MANAGER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.length) {
    res.status(403).json({ error: "Manager access is not configured" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    );
    if (
      !primaryEmail ||
      primaryEmail.verification?.status !== "verified" ||
      !allowlist.includes(primaryEmail.emailAddress.trim().toLowerCase())
    ) {
      res.status(403).json({ error: "Manager access denied" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};