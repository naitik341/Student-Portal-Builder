import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import type { Request } from "express";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

function normalizeOrigin(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed);
  const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(
    trimmed,
  );
  try {
    const parsed = new URL(
      hasProtocol ? trimmed : `${localHost ? "http" : "https"}://${trimmed}`,
    );
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue?.split(",")[0]?.trim() || undefined;
}

const configuredOrigins = new Set(
  [
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.EXPO_PUBLIC_DOMAIN,
    process.env.REPLIT_EXPO_DEV_DOMAIN,
    process.env.REPLIT_DEV_DOMAIN,
    process.env.REPLIT_DOMAINS,
    process.env.REPLIT_DEPLOYMENT_URL,
    process.env.REPLIT_DEPLOYMENT_DOMAIN,
  ]
    .flatMap((value) => value?.split(",") ?? [])
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin)),
);

function requestOrigin(req: Request): string | undefined {
  const host =
    firstHeader(req.headers["x-forwarded-host"]) ?? req.get("host");
  if (!host) return undefined;
  const protocol =
    firstHeader(req.headers["x-forwarded-proto"]) ?? req.protocol;
  return normalizeOrigin(`${protocol}://${host}`);
}

function isTrustedOrigin(origin: string, req: Request): boolean {
  const normalized = normalizeOrigin(origin);
  return Boolean(
    normalized &&
      (configuredOrigins.has(normalized) || normalized === requestOrigin(req)),
  );
}

const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) {
      callback(null, false);
      return;
    }
    callback(null, origin);
  },
};

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && !isTrustedOrigin(origin, req)) {
    res.status(403).json({ error: "Origin is not allowed" });
    return;
  }
  next();
});
app.use(cors(corsOptions));

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
);

app.use("/api", router);

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const parserError = error as { status?: number; type?: string };
    if (parserError.status === 413 || parserError.type === "entity.too.large") {
      res.status(413).json({ error: "Request body too large" });
      return;
    }
    if (parserError.status === 400 && parserError.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON request body" });
      return;
    }
    return next(error);
  },
);

export default app;
