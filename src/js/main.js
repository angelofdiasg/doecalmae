const campaignConfig = {
  partnerEmail: "",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const paymentStatus = document.querySelector("#payment-status");
const donationStatus = document.querySelector("#donation-status");
const partnerStatus = document.querySelector("#partner-status");
const customAmountInput = document.querySelector("#custom-amount");
const donationForm = document.querySelector("#donation-form");
const donationSubmit = document.querySelector("#donation-submit");
const paymentMethodNote = document.querySelector("#payment-method-note");
const apiBaseUrl = document.querySelector('meta[name="calmae-api-base-url"]').content.trim()
  || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:3000" : "");
let selectedAmount = 50;
let selectedPartnerAmount = null;
const savedDonationRequestId = sessionStorage.getItem("calmae-donation-request-id");
let donationRequestId = savedDonationRequestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedDonationRequestId)
  ? savedDonationRequestId
  : crypto.randomUUID();
sessionStorage.setItem("calmae-donation-request-id", donationRequestId);

function setSelectedAmount(amount) {
  selectedAmount = amount;
  customAmountInput.value = "";

  document.querySelectorAll(".donation-choice").forEach((button) => {
    const isSelected = Number(button.dataset.amount) === amount;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function updatePaymentOptions() {
  const frequency = donationForm.elements.frequency.value;
  const cardOption = donationForm.querySelector('input[name="payment-method"][value="CREDIT_CARD"]');
  const cardLabel = cardOption.closest("label");

  cardOption.disabled = frequency === "monthly";
  cardLabel.hidden = cardOption.disabled;

  if (cardOption.disabled && cardOption.checked) {
    donationForm.querySelector('input[name="payment-method"][value="PIX"]').checked = true;
  }

  paymentMethodNote.textContent = frequency === "monthly"
    ? "O Asaas enviará uma cobrança Pix ou boleto a cada mês. Cada cobrança precisa ser paga; não há débito automático. Cartão mensal ainda não está habilitado."
    : "O pagamento será concluído no ambiente seguro do Asaas.";
}

document.querySelectorAll(".donation-choice").forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedAmount(Number(button.dataset.amount));
    donationStatus.textContent = `${currency.format(selectedAmount)} selecionados.`;
  });
});

document.querySelectorAll(".amount-button").forEach((button) => {
  button.addEventListener("click", () => {
    const amount = Number(button.dataset.amount);
    setSelectedAmount(amount);
    paymentStatus.textContent = `${currency.format(amount)} selecionados para apoiar a campanha.`;
    document.querySelector("#pessoas").scrollIntoView({ behavior: "smooth" });
    donationStatus.textContent = `${currency.format(amount)} selecionados.`;
  });
});

document.querySelectorAll(".partner-tier").forEach((button) => {
  button.addEventListener("click", () => {
    selectedPartnerAmount = Number(button.dataset.amount);
    partnerStatus.textContent =
      `Cota de ${currency.format(selectedPartnerAmount)} selecionada para financiar ${Math.round(selectedPartnerAmount / 1500)} jovens.`;
  });
});

customAmountInput.addEventListener("input", () => {
  document.querySelectorAll(".donation-choice").forEach((button) => {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
  donationStatus.textContent = "";
});

donationForm.addEventListener("change", (event) => {
  if (event.target.name === "frequency") {
    updatePaymentOptions();
  }
});

donationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const customAmount = Number(customAmountInput.value);
  const amount = customAmountInput.value ? customAmount : selectedAmount;

  if (!Number.isFinite(amount) || amount <= 0) {
    donationStatus.textContent = "Informe um valor válido para continuar.";
    return;
  }

  if (!apiBaseUrl) {
    donationStatus.textContent = "O pagamento ainda não está configurado neste site.";
    return;
  }

  const formData = new FormData(donationForm);
  const payload = {
    amount,
    frequency: formData.get("frequency"),
    paymentMethod: formData.get("payment-method"),
    name: formData.get("name").trim(),
    email: formData.get("email").trim(),
    cpfCnpj: formData.get("cpfCnpj").replace(/\D/g, ""),
    phone: formData.get("phone").replace(/\D/g, ""),
    requestId: donationRequestId,
  };

  donationSubmit.disabled = true;
  donationStatus.textContent = "Preparando o pagamento seguro...";

  try {
    let response;
    try {
      response = await fetch(new URL("/api/donations", apiBaseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error("Não foi possível conectar ao serviço de doações. Tente novamente mais tarde.");
    }
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Não foi possível iniciar o pagamento.");
    }

    const checkoutUrl = new URL(result.checkoutUrl);
    if (checkoutUrl.protocol !== "https:" || !["asaas.com", "www.asaas.com"].includes(checkoutUrl.hostname)) {
      throw new Error("O Asaas retornou um endereço de pagamento inválido.");
    }

    donationRequestId = crypto.randomUUID();
    sessionStorage.setItem("calmae-donation-request-id", donationRequestId);
    window.location.assign(checkoutUrl.href);
  } catch (error) {
    donationStatus.textContent = error.message || "Não foi possível iniciar o pagamento. Tente novamente.";
    donationSubmit.disabled = false;
  }
});

updatePaymentOptions();

document.querySelector("#partner-contact").addEventListener("click", () => {
  if (!campaignConfig.partnerEmail) {
    partnerStatus.textContent = selectedPartnerAmount
      ? `Cota de ${currency.format(selectedPartnerAmount)} para ${Math.round(selectedPartnerAmount / 1500)} jovens selecionada. O contato para parcerias será divulgado em breve.`
      : "O contato para parcerias será divulgado em breve. Selecione uma cota para conhecer o impacto da sua empresa.";
    return;
  }

  const subject = encodeURIComponent("Parceria empresarial — Calmaê Jovem");
  const body = selectedPartnerAmount
    ? encodeURIComponent(`Tenho interesse na cota de ${currency.format(selectedPartnerAmount)} para apoiar o Calmaê Jovem.`)
    : "";
  window.location.href = `mailto:${campaignConfig.partnerEmail}?subject=${subject}${body ? `&body=${body}` : ""}`;
});

const videoFrame = document.querySelector(".video-frame");
const videoUrl = videoFrame.dataset.videoUrl.trim();

if (videoUrl) {
  const parsedUrl = new URL(videoUrl);
  let embedUrl;

  if (["www.youtube.com", "youtube.com", "youtu.be"].includes(parsedUrl.hostname)) {
    const videoId =
      parsedUrl.hostname === "youtu.be"
        ? parsedUrl.pathname.slice(1)
        : parsedUrl.searchParams.get("v");

    if (videoId) {
      embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    }
  } else if (["vimeo.com", "www.vimeo.com"].includes(parsedUrl.hostname)) {
    const videoId = parsedUrl.pathname.split("/").filter(Boolean).pop();

    if (videoId && /^\d+$/.test(videoId)) {
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }
  }

  if (embedUrl) {
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.title = "Depoimentos do Calmaê Jovem";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.loading = "lazy";
    iframe.allowFullscreen = true;
    videoFrame.replaceChildren(iframe);
  } else {
    console.error("A URL de vídeo deve ser um link válido do YouTube ou Vimeo.");
  }
}
