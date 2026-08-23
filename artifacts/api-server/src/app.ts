import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
// Stripe signs the exact request bytes; keep this route raw before JSON parsing.
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
// File uploads (/api/extract) send base64 JSON up to ~11 MB; everything else keeps the small default limit.
const defaultJson = express.json();
const largeJson = express.json({ limit: "75mb" });
app.use((req, res, next) => (req.path.endsWith("/extract") || req.path.endsWith("/design") ? largeJson : defaultJson)(req, res, next));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production, serve the built React frontend as static files.
// The esbuild banner sets __dirname to the bundle directory (artifacts/api-server/dist),
// so ../../bewerbungski/dist/public resolves to the Vite build output.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(
    __dirname,
    "../../bewerbungski/dist/public",
  );

  // Internal/login-only pages must not appear in Google results.
  // X-Robots-Tag is delivered in the initial HTTP response, before JS runs —
  // more reliable than a client-side <meta> tag for Googlebot.
  // Pattern matches /{lang?}/(wizard|documents|preview|scanner|import|admin)(/ or end).
  const NOINDEX_RE =
    /^\/(?:(?:en|es|tr|ar|uk|ru|pl)\/)?(?:wizard|documents|preview|scanner|import|admin)(?:\/|$)/;

  app.use((req, res, next) => {
    if (NOINDEX_RE.test(req.path)) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    next();
  });

  app.use(express.static(frontendDist));
  // SPA fallback: any non-/api route serves index.html
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
