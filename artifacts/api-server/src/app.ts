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
// Stripe webhook needs the raw body for signature verification
app.use("/api/webhook/stripe", express.raw({ type: "application/json" }));
app.use(express.json());
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
  app.use(express.static(frontendDist));
  // SPA fallback: any non-/api route serves index.html
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
