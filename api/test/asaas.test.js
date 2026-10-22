import test from "node:test";
import assert from "node:assert/strict";
import { createAsaasClient, nextDueDate } from "../src/asaas.js";

test("restricts the Asaas API to its official HTTPS hosts", () => {
  assert.throws(
    () => createAsaasClient({ apiKey: "key", baseUrl: "https://attacker.example" }),
    /official Asaas API/,
  );
});

test("creates a customer and single charge using server-side credentials", async () => {
  const calls = [];
  const client = createAsaasClient({
    apiKey: "sandbox-key",
    baseUrl: "https://api-sandbox.asaas.com",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({ id: "cus_test", invoiceUrl: "https://www.asaas.com/i/test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await client.createCustomer({
    name: "Pessoa Doadora",
    email: "doador@example.org",
    cpfCnpj: "12345678901",
    phone: "11912345678",
    frequency: "once",
  });
  await client.createPayment({
    customerId: "cus_test",
    amount: 50,
    billingType: "PIX",
    externalReference: "donation-id",
    dueDate: "2026-10-22",
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.access_token, "sandbox-key");
  assert.equal(calls[0].url, "https://api-sandbox.asaas.com/v3/customers");
  assert.equal(JSON.parse(calls[0].options.body).notificationDisabled, true);
  assert.equal(calls[1].url, "https://api-sandbox.asaas.com/v3/payments");
  assert.equal(JSON.parse(calls[1].options.body).billingType, "PIX");
});

test("calculates the next due date in UTC", () => {
  assert.equal(nextDueDate(new Date("2026-10-21T12:00:00.000Z")), "2026-10-22");
});
