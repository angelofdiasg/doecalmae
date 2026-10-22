import test from "node:test";
import assert from "node:assert/strict";
import { donationSchema } from "../src/validation.js";

const validDonation = {
  requestId: "0ea3e0ec-f35d-4fad-8c02-19ab7dd81442",
  amount: 50,
  frequency: "once",
  paymentMethod: "PIX",
  name: "Pessoa Doadora",
  email: "doador@example.org",
  cpfCnpj: "123.456.789-01",
  phone: "(11) 91234-5678",
};

test("accepts one-time Pix donations and normalizes personal identifiers", () => {
  const result = donationSchema.parse(validDonation);
  assert.equal(result.cpfCnpj, "12345678901");
  assert.equal(result.phone, "11912345678");
});

test("rejects card-based monthly donations", () => {
  const result = donationSchema.safeParse({
    ...validDonation,
    frequency: "monthly",
    paymentMethod: "CREDIT_CARD",
  });
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /ainda não está habilitada/);
});

test("rejects invalid amounts and identifier lengths", () => {
  assert.equal(donationSchema.safeParse({ ...validDonation, amount: 0 }).success, false);
  assert.equal(donationSchema.safeParse({ ...validDonation, cpfCnpj: "1234" }).success, false);
});
