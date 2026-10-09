const campaignConfig = {
  paymentUrl: "",
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
let selectedAmount = 50;
let selectedPartnerAmount = null;

function setSelectedAmount(amount) {
  selectedAmount = amount;
  customAmountInput.value = "";

  document.querySelectorAll(".donation-choice").forEach((button) => {
    const isSelected = Number(button.dataset.amount) === amount;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function goToPayment(amount, statusElement) {
  if (!Number.isFinite(amount) || amount <= 0) {
    statusElement.textContent = "Escolha um valor válido para continuar.";
    return;
  }

  if (!campaignConfig.paymentUrl) {
    statusElement.textContent =
      `A contribuição de ${currency.format(amount)} foi selecionada. O link de pagamento será disponibilizado em breve.`;
    return;
  }

  const paymentUrl = new URL(campaignConfig.paymentUrl);
  paymentUrl.searchParams.set("amount", String(amount));
  window.location.assign(paymentUrl);
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

document.querySelector("#donation-submit").addEventListener("click", () => {
  const customAmount = Number(customAmountInput.value);
  const amount = customAmountInput.value ? customAmount : selectedAmount;
  goToPayment(amount, donationStatus);
});

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
