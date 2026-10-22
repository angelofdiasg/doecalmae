import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function withServer(app, run) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("creates a pending checkout without persisting donor personal data", async () => {
  const databaseCalls = [];
  const pool = {
    async query(sql, values) {
      databaseCalls.push({ sql, values });
      return { rowCount: 1, rows: [{ id: "donation-id" }] };
    },
    async connect() {
      throw new Error("Webhook connection not expected in this test");
    },
  };
  const asaas = {
    nextDueDate: () => "2026-10-22",
    async createCustomer(donor) {
      assert.equal(donor.email, "doador@example.org");
      return { id: "customer-id" };
    },
    async createPayment() {
      return { id: "payment-id", invoiceUrl: "https://www.asaas.com/i/test" };
    },
  };
  const app = createApp({
    pool,
    asaas,
    frontendOrigin: "https://calmae.example.org",
    webhookToken: "test-webhook-token",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "0ea3e0ec-f35d-4fad-8c02-19ab7dd81442",
        amount: 50,
        frequency: "once",
        paymentMethod: "PIX",
        name: "Pessoa Doadora",
        email: "doador@example.org",
        cpfCnpj: "12345678901",
        phone: "11912345678",
      }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { checkoutUrl: "https://www.asaas.com/i/test" });
    assert.equal(databaseCalls.length, 2);
    assert.equal(databaseCalls[0].values.includes("doador@example.org"), false);
    assert.equal(databaseCalls[0].values.includes("Pessoa Doadora"), false);
  });
});

test("rejects an invalid request before contacting the database", async () => {
  const pool = {
    async query() {
      throw new Error("Database should not be used for invalid input");
    },
  };
  const app = createApp({
    pool,
    asaas: {},
    frontendOrigin: "https://calmae.example.org",
    webhookToken: "test-webhook-token",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: -10 }),
    });
    assert.equal(response.status, 400);
  });
});

test("creates a monthly subscription and returns its first hosted invoice", async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rowCount: 1, rows: [{ id: "donation-id" }] };
    },
  };
  const asaas = {
    nextDueDate: () => "2026-10-22",
    async createCustomer(donor) {
      assert.equal(donor.frequency, "monthly");
      return { id: "customer-id" };
    },
    async createSubscription(options) {
      calls.push({ subscription: options });
      return { id: "subscription-id" };
    },
    async getSubscriptionPayments(id) {
      calls.push({ paymentsFor: id });
      return { data: [{ id: "first-payment", invoiceUrl: "https://www.asaas.com/i/monthly" }] };
    },
    async deleteSubscription() {
      assert.fail("A valid monthly invoice should not be cancelled");
    },
  };
  const app = createApp({
    pool,
    asaas,
    frontendOrigin: "https://calmae.example.org",
    webhookToken: "test-webhook-token",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "3ea3e0ec-f35d-4fad-8c02-19ab7dd81442",
        amount: 100,
        frequency: "monthly",
        paymentMethod: "PIX",
        name: "Pessoa Doadora",
        email: "doador@example.org",
        cpfCnpj: "12345678901",
        phone: "11912345678",
      }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { checkoutUrl: "https://www.asaas.com/i/monthly" });
    assert.equal(calls.find((call) => call.subscription)?.subscription.billingType, "PIX");
    assert.equal(calls.find((call) => call.paymentsFor)?.paymentsFor, "subscription-id");
  });
});

test("requires the Asaas webhook token", async () => {
  const app = createApp({
    pool: {},
    asaas: {},
    frontendOrigin: "https://calmae.example.org",
    webhookToken: "test-webhook-token",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/webhooks/asaas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "event-id", event: "PAYMENT_RECEIVED", payment: { id: "payment-id" } }),
    });
    assert.equal(response.status, 401);
  });
});

test("records authenticated payment webhooks and applies the confirmed status", async () => {
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          queries.push({ sql, values });
          if (sql.includes("INSERT INTO asaas_webhook_events")) return { rowCount: 1 };
          return { rowCount: 1 };
        },
        release() {},
      };
    },
  };
  const app = createApp({
    pool,
    asaas: {},
    frontendOrigin: "https://calmae.example.org",
    webhookToken: "test-webhook-token",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/webhooks/asaas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "test-webhook-token",
      },
      body: JSON.stringify({
        id: "evt_test",
        event: "PAYMENT_CONFIRMED",
        payment: { id: "payment-id", subscription: "subscription-id" },
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });
    assert.equal(queries[2].values[0], "PAID");
    assert.equal(queries[2].values[1], "payment-id");
    assert.equal(queries[2].values[2], "subscription-id");
  });
});
