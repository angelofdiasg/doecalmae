const API_TIMEOUT_MS = 12_000;

export class AsaasError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
  }
}

export function createAsaasClient({ apiKey, baseUrl, fetchImpl = fetch }) {
  const base = new URL(baseUrl);
  if (
    !["api-sandbox.asaas.com", "api.asaas.com"].includes(base.hostname)
    || base.protocol !== "https:"
    || (base.port && base.port !== "443")
    || base.username
    || base.password
  ) {
    throw new Error("ASAAS_BASE_URL must point to the official Asaas API over HTTPS.");
  }

  async function request(path, { method = "GET", body } = {}) {
    let response;
    try {
      response = await fetchImpl(new URL(`/v3${path}`, base), {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    } catch {
      throw new AsaasError("Não foi possível conectar ao Asaas. Tente novamente mais tarde.");
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const descriptions = Array.isArray(result.errors)
        ? result.errors.map((item) => item.description).filter(Boolean)
        : [];
      throw new AsaasError(
        descriptions[0] || "O Asaas não conseguiu iniciar este pagamento. Verifique os dados e tente novamente.",
        response.status >= 400 && response.status < 500 ? 400 : 502,
      );
    }

    return result;
  }

  return {
    async createCustomer(donor) {
      return request("/customers", {
        method: "POST",
        body: {
          name: donor.name,
          email: donor.email,
          cpfCnpj: donor.cpfCnpj,
          mobilePhone: donor.phone,
          notificationDisabled: donor.frequency !== "monthly",
        },
      });
    },

    async createPayment({ customerId, amount, billingType, externalReference, dueDate }) {
      return request("/payments", {
        method: "POST",
        body: {
          customer: customerId,
          billingType,
          value: amount,
          dueDate,
          description: "Doação para a campanha Calmaê Jovem",
          externalReference,
        },
      });
    },

    async createSubscription({ customerId, amount, billingType, externalReference, nextDueDate }) {
      return request("/subscriptions", {
        method: "POST",
        body: {
          customer: customerId,
          billingType,
          value: amount,
          cycle: "MONTHLY",
          nextDueDate,
          description: "Doação mensal para a campanha Calmaê Jovem",
          externalReference,
        },
      });
    },

    async getSubscriptionPayments(subscriptionId) {
      return request(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?offset=0&limit=1`);
    },

    async deleteSubscription(subscriptionId) {
      return request(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
    },
  };
}

export function nextDueDate(from = new Date()) {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
