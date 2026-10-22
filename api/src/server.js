import "dotenv/config";
import pg from "pg";
import { createApp } from "./app.js";
import { createAsaasClient, nextDueDate } from "./asaas.js";

const required = ["DATABASE_URL", "FRONTEND_ORIGIN", "ASAAS_API_KEY", "ASAAS_WEBHOOK_TOKEN", "ASAAS_BASE_URL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const frontendUrl = new URL(process.env.FRONTEND_ORIGIN);
const localFrontend = ["localhost", "127.0.0.1"].includes(frontendUrl.hostname);
if (
  (frontendUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && localFrontend && frontendUrl.protocol === "http:"))
  || frontendUrl.origin !== process.env.FRONTEND_ORIGIN
) {
  throw new Error("FRONTEND_ORIGIN must be an exact HTTPS origin (HTTP localhost is allowed outside production).");
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const asaas = {
  ...createAsaasClient({
    apiKey: process.env.ASAAS_API_KEY,
    baseUrl: process.env.ASAAS_BASE_URL,
  }),
  nextDueDate,
};

const app = createApp({
  pool,
  asaas,
  frontendOrigin: frontendUrl.origin,
  webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
});

const server = app.listen(port, () => {
  console.log(`Calmaê donation API listening on port ${port}.`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
