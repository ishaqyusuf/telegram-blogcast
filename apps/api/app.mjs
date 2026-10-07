import { Hono } from "hono";
import backend from "./dist/api.js";

// Vercel detects this Hono entry. The build bundles the workspace/alias graph;
// the same application still runs from src/index.ts for the local gateway.
const app = new Hono();
app.all("*", (context) => backend.fetch(context.req.raw));
export default app;
