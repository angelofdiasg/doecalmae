import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { donationSchema } from "./validation.js";

const statusForEvent = {
  PAYMENT_CONFIRMED: "PAID",
  PAYMENT_RECEIVED: "PAID",
  PAYMENT_OVERDUE: "OVERDUE",
  PAYMENT_DELETED: "CANCELLED",
  PAYMENT_REFUNDED: "REFUNDED",
  PAYMENT_PARTIALLY_REFUNDED: "REFUNDED",
  PAYMENT_CHARGEBACK_REQUESTED: "UNDER_REVIEW",
};

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

function tokensMatch(received, expected) {
  if (!received || !expected) return false;
  const receivedDigest = createHmac("sha256", "calmae-webhook").update(received).digest();
  const expectedDigest = createHmac("sha256", "calmae-webhook").update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

export function createApp({ pool, asaas, frontendOrigin, webhookToken }) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({
    origin: frontendOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "asaas-access-token"],
  }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/api/health", asyncHandler(async (_request, response) => {
    try {
      await pool.query("SELECT 1");
      response.json({ status: "ok" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  }));

  app.post("/api/donations", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({
      error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
    }),
  }));

  app.post("/api/donations", asyncHandler(async (request, response) => {
    const parsed = donationSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: parsed.error.issues[0]?.message || "Confira os dados da doação.",
      });
    }

    const donor = parsed.data;
    const donationId = randomUUID();
    const billingType = donor.paymentMethod;
    const inserted = await pool.query(
      `INSERT INTO donations (id, request_id, amount, frequency, billing_type, status)
       VALUES ($1, $2, $3, $4, $5, 'CREATING')
       ON CONFLICT (request_id) DO NOTHING
       RETURNING id`,
      [donationId, donor.requestId, donor.amount, donor.frequency, billingType],
    );
    if (!inserted.rowCount) {
      const existing = await pool.query(
        "SELECT amount, frequency, billing_type, checkout_url FROM donations WHERE request_id = $1",
        [donor.requestId],
      );
      const previous = existing.rows[0];
      if (
        previous
        && Number(previous.amount) === donor.amount
        && previous.frequency === donor.frequency
        && previous.billing_type === billingType
        && previous.checkout_url
      ) {
        return response.json({ checkoutUrl: previous.checkout_url });
      }
      if (previous && (Number(previous.amount) !== donor.amount
        || previous.frequency !== donor.frequency
        || previous.billing_type !== billingType)) {
        return response.status(409).json({
          error: "Este pedido já foi usado com outros dados. Atualize a página para iniciar uma nova tentativa.",
        });
      }
      return response.status(409).json({
        error: "Este pedido já está em processamento. Não repita o pagamento; aguarde ou entre em contato com a equipe.",
      });
    }

    let subscriptionId;
    try {
      const customer = await asaas.createCustomer(donor);
      let payment;
      if (donor.frequency === "monthly") {
        const subscription = await asaas.createSubscription({
          customerId: customer.id,
          amount: donor.amount,
          billingType,
          externalReference: donationId,
          nextDueDate: asaas.nextDueDate(),
        });
        subscriptionId = subscription.id;
        const payments = await asaas.getSubscriptionPayments(subscription.id);
        payment = payments.data?.[0];
      } else {
        payment = await asaas.createPayment({
          customerId: customer.id,
          amount: donor.amount,
          billingType,
          externalReference: donationId,
          dueDate: asaas.nextDueDate(),
        });
      }

      const checkoutUrl = payment?.invoiceUrl;
      const checkout = checkoutUrl ? new URL(checkoutUrl) : null;
      if (!checkout || checkout.protocol !== "https:" || checkout.hostname !== "www.asaas.com" || !payment.id) {
        if (subscriptionId) await asaas.deleteSubscription(subscriptionId);
        throw new Error("O Asaas não retornou uma fatura válida para pagamento.");
      }

      await pool.query(
        `UPDATE donations
         SET asaas_customer_id = $1, asaas_payment_id = $2,
             asaas_subscription_id = $3, checkout_url = $4,
             status = 'PENDING', updated_at = NOW()
         WHERE id = $5`,
        [customer.id, payment.id, subscriptionId || null, checkoutUrl, donationId],
      );

      return response.status(201).json({ checkoutUrl });
    } catch (error) {
      if (subscriptionId && error.message !== "O Asaas não retornou uma fatura válida para pagamento.") {
        try {
          await asaas.deleteSubscription(subscriptionId);
        } catch {
          console.error("Falha ao cancelar uma assinatura incompleta no Asaas.");
        }
      }
      await pool.query(
        "UPDATE donations SET status = 'FAILED', updated_at = NOW() WHERE id = $1",
        [donationId],
      );
      console.error("Falha ao criar checkout de doação:", error.name || "Error");
      const status = Number.isInteger(error.status) ? error.status : 502;
      return response.status(status).json({
        error: error.status ? error.message : "Não foi possível criar a cobrança. Recarregue a página ou tente novamente mais tarde.",
      });
    }
  }));

  app.post("/api/webhooks/asaas", asyncHandler(async (request, response) => {
    if (!tokensMatch(request.get("asaas-access-token"), webhookToken)) {
      return response.status(401).json({ error: "Unauthorized" });
    }

    const { id: eventId, event, payment } = request.body || {};
    if (typeof eventId !== "string" || typeof event !== "string" || !payment?.id) {
      return response.status(400).json({ error: "Invalid webhook event" });
    }

    const status = statusForEvent[event];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO asaas_webhook_events (event_id, event_name)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, event],
      );
      if (inserted.rowCount && status) {
        await client.query(
          `UPDATE donations
           SET status = $1, updated_at = NOW()
           WHERE asaas_payment_id = $2
              OR asaas_subscription_id = $3`,
          [status, payment.id, payment.subscription || null],
        );
      }
      await client.query("COMMIT");
      return response.status(200).json({ received: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Falha ao processar webhook do Asaas:", error.name || "Error");
      return response.status(500).json({ error: "Webhook processing failed" });
    } finally {
      client.release();
    }
  }));

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({ error: "JSON inválido." });
    }
    console.error("Erro não tratado na API:", error.name || "Error");
    return response.status(500).json({ error: "Ocorreu um erro inesperado." });
  });

  return app;
}
