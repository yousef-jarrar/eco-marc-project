const messagesBox = document.getElementById("messages");
const assistantForm = document.getElementById("assistant-form");
const questionInput = document.getElementById("question");
const sendButton = document.getElementById("send-question");
const cancelButton = document.getElementById("cancel-question");
const clearButton = document.getElementById("clear-conversation");
const refreshInsightsButton = document.getElementById("refresh-insights");
const connectionStatus = document.getElementById("connection-status");
const reportingForm = document.getElementById("reporting-form");
const periodPreset = document.getElementById("period-preset");
const fromInput = document.getElementById("period-from");
const toInput = document.getElementById("period-to");

let sendingMessage = false;
let loadingInsights = false;
let messageController = null;
let conversation = [];
let activePeriod = null;

function getToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = {};
  for (const part of parts) values[part.type] = part.value;
  return values.year + "-" + values.month + "-" + values.day;
}

function shiftDate(value, days) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function choosePreset() {
  if (periodPreset.value === "custom") return;
  const today = getToday();
  toInput.value = today;
  if (periodPreset.value === "7") fromInput.value = shiftDate(today, -6);
  else if (periodPreset.value === "30") fromInput.value = shiftDate(today, -29);
  else if (periodPreset.value === "month") fromInput.value = today.slice(0, 7) + "-01";
  else if (periodPreset.value === "last-month") {
    toInput.value = shiftDate(today.slice(0, 7) + "-01", -1);
    fromInput.value = toInput.value.slice(0, 7) + "-01";
  }
}

function getSelectedPeriod() {
  if (fromInput.value === "" || toInput.value === "") throw new Error("Choose a start and end date.");
  if (fromInput.value > toInput.value) throw new Error("The start date must be before the end date.");
  if (toInput.value > getToday()) throw new Error("Reports cannot include future dates.");
  const days = (Date.parse(toInput.value) - Date.parse(fromInput.value)) / 86400000 + 1;
  if (days > 366) throw new Error("Choose a period of 366 days or less.");
  return { from: fromInput.value, to: toInput.value };
}

function updateControls() {
  const busy = sendingMessage || loadingInsights;
  questionInput.disabled = busy;
  sendButton.disabled = busy || !activePeriod || questionInput.value.trim() === "";
  refreshInsightsButton.disabled = busy;
  clearButton.disabled = busy;
  cancelButton.hidden = !sendingMessage;
  assistantForm.setAttribute("aria-busy", String(sendingMessage));

  for (const button of document.querySelectorAll("[data-question]")) button.disabled = busy || !activePeriod;
  document.getElementById("conversation-state").textContent = sendingMessage ? "Preparing your answer… You can stop this request." : loadingInsights ? "Updating store context…" : activePeriod ? "Store records in context · Ask a follow-up at any time" : "Refresh store context above to start a conversation.";
  document.getElementById("assistant-workspace").classList.toggle("is-thinking", sendingMessage);
  refreshInsightsButton.innerHTML = fa(loadingInsights ? "spinner fa-spin" : "rotate") + (loadingInsights ? " Updating…" : " Refresh context");
  for (const control of reportingForm.querySelectorAll("input, select, button")) control.disabled = busy;
}

function addMessage(role, message, failed = false) {
  document.getElementById("chat-welcome").hidden = true;
  messagesBox.hidden = false;
  const article = document.createElement("article");
  article.className = "message " + role;
  if (failed) article.classList.add("failed");

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "LUMIÈRE Business Assistant";
  if (role === "user") label.textContent = "You";

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = message;
  text.dir = "auto";
  article.appendChild(label);
  article.appendChild(text);
  messagesBox.appendChild(article);
  if (role === "user") messagesBox.scrollTop = messagesBox.scrollHeight;
  return article;
}

function updateCharacterCount() {
  document.getElementById("character-count").textContent = Array.from(questionInput.value).length + " / 1000";
  questionInput.style.height = "auto";
  questionInput.style.height = Math.min(160, questionInput.scrollHeight) + "px";
  sendButton.disabled = sendingMessage || loadingInsights || !activePeriod || questionInput.value.trim() === "";
}

 
function getConversationHistory() {
  const history = conversation.slice(-8);
  let length = 0;
  for (const message of history) length += Array.from(message.content).length;
  while (length > 14000 && history.length > 2) {
    length -= Array.from(history.shift().content).length;
    length -= Array.from(history.shift().content).length;
  }
  return history;
}

function stockLevel(quantity) {
  return quantity <= 0 ? "out" : quantity <= 5 ? "low" : "available";
}

function stockColor(color) {
  const palette = {black:"#202020",white:"#fff",gray:"#969696",red:"#a43c3c",blue:"#476a8d",navy:"#202e45",green:"#466651",yellow:"#c9ac44",orange:"#bf7e43",pink:"#d599ad",purple:"#8a6b9d",brown:"#775741",beige:"#d6c7b0",other:"#b7b3aa"};
  return palette[String(color).toLowerCase()] || palette.other;
}

function showStockDetails(productId, productName, stock) {
  const variants = stock.filter(variant => Number(variant.product_id) === Number(productId)).map(variant => ({...variant, quantity: Math.max(0, number(variant.quantity))}));
  variants.sort((a, b) => a.quantity - b.quantity || String(a.color).localeCompare(String(b.color)) || String(a.size).localeCompare(String(b.size), undefined, {numeric: true}));
  const total = variants.reduce((sum, variant) => sum + variant.quantity, 0);
  const low = variants.filter(variant => stockLevel(variant.quantity) === "low").length;
  const out = variants.filter(variant => stockLevel(variant.quantity) === "out").length;
  const html = `<div class="ai-stock-details">
    <p class="ai-stock-product">${escapeHTML(productName)}</p>
    <p class="ai-stock-caption">Stock returned with this answer. Low stock means 1–5 units in a variant.</p>
    <div class="ai-stock-summary"><div><strong>${total}</strong><span>Total units</span></div><div><strong>${variants.length}</strong><span>Variants shown</span></div><div class="stock-summary-low"><strong>${low}</strong><span>Low stock</span></div><div class="stock-summary-out"><strong>${out}</strong><span>Out of stock</span></div></div>
    <div class="ai-stock-filters"><div><label for="ai-stock-search">Find a variant</label><input type="search" id="ai-stock-search" placeholder="Color or size…"></div><div><label for="ai-stock-status">Availability</label><select id="ai-stock-status"><option value="">All variants</option><option value="out">Out of stock</option><option value="low">Low stock (1–5)</option><option value="available">In stock (6+)</option></select></div></div>
    <div class="ai-stock-table-wrap"><table class="ai-stock-table"><thead><tr><th>Color</th><th>Size</th><th>Units</th><th>Status</th></tr></thead><tbody id="ai-stock-rows"></tbody></table></div>
    <p id="ai-stock-count" class="ai-stock-count" role="status"></p>
    <a class="ai-stock-product-link" href="ProductDetails.html?id=${encodeURIComponent(productId)}">${fa("arrow-up-right-from-square")} Open product details</a>
  </div>`;
  const dialog = Alerts.show("Stock details", "", "info", {icon: undefined, html, width: 720, customClass: {popup: "ai-stock-dialog"}, confirmButtonText: "Done", showCloseButton: true, closeButtonAriaLabel: "Close stock details"});
  const search = document.getElementById("ai-stock-search");
  const status = document.getElementById("ai-stock-status");
  function renderStock() {
    const query = search.value.trim().toLowerCase();
    const filtered = variants.filter(variant => (String(variant.color) + " " + variant.size).toLowerCase().includes(query) && (!status.value || stockLevel(variant.quantity) === status.value));
    const rows = document.getElementById("ai-stock-rows");
    rows.innerHTML = filtered.map(variant => {
      const level = stockLevel(variant.quantity);
      return `<tr><td data-label="Color"><span class="ai-stock-color"><span style="background:${stockColor(variant.color)}" aria-hidden="true"></span>${escapeHTML(variant.color || "Not set")}</span></td><td data-label="Size"><span class="ai-stock-size">${escapeHTML(variant.size || "Not set")}</span></td><td data-label="Units"><strong class="ai-stock-quantity">${variant.quantity}</strong></td><td data-label="Status"><span class="ai-stock-status ${level}">${fa(level === "out" ? "circle-xmark" : level === "low" ? "triangle-exclamation" : "check")}${level === "out" ? "Out of stock" : level === "low" ? "Low stock" : "In stock"}</span></td></tr>`;
    }).join("") || '<tr><td colspan="4"><div class="ai-stock-empty">'+fa("box-open")+'<strong>'+ (variants.length ? "No matching variants" : "No stock details returned") +'</strong><p>'+ (variants.length ? "Try another color, size or availability." : "Ask a new stock question for this product.") +'</p></div></td></tr>';
    document.getElementById("ai-stock-count").textContent = filtered.length + " of " + variants.length + " variants · Lowest stock first";
  }
  search.addEventListener("input", renderStock);
  status.addEventListener("change", renderStock);
  renderStock();
  return dialog;
}

function addStockButton(container, productId, productName, stock) {
  let available = false;
  for (const variant of stock) {
    if (Number(variant.product_id) === Number(productId)) available = true;
  }
  if (!available) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary stock-details-button";
  button.innerHTML = fa("boxes-stacked") + " Stock details";
  button.setAttribute("aria-label", "Stock details for " + productName);
  button.addEventListener("click", function () {
    showStockDetails(productId, productName, stock);
  });
  container.appendChild(button);
}

function showAnswerDetails(article, result) {
  AdminAnswerView.renderSummary(article, result);
  if (result.period) {
    const caption = document.createElement("div");
    caption.className = "answer-period";
    caption.textContent = "Sales / reviews: " + result.period.from + " — " + result.period.to + " · Inventory: current";
    article.appendChild(caption);
  }
  if (result.source === "calculated" && result.notice) {
    const notice = document.createElement("div");
    notice.className = "answer-notice";
    notice.textContent = result.notice;
    article.appendChild(notice);
  }

  const cards = result.cards;
  if (!cards || !Array.isArray(cards.items) || cards.type === "summary") return;
  const panel = document.createElement("div");
  panel.className = "answer-details";
  const heading = document.createElement("h3");
  heading.textContent = "Store records";
  if (cards.type === "inventory") heading.textContent = "Current low-stock variants";
  if (cards.type === "products") heading.textContent = "Top products in this period";
  if (cards.type === "reviews") heading.textContent = "Lowest approved ratings in this period";
  if (cards.type === "orders") heading.textContent = "Orders in this period";
  panel.appendChild(heading);

  if (cards.items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tiny muted";
    empty.textContent = "No matching records were returned.";
    panel.appendChild(empty);
  }

  const stock = getList(result.product_stock);
  for (const row of cards.items.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = "answer-item";
    const description = document.createElement("div");
    const name = document.createElement("strong");
    const detail = document.createElement("small");
    name.textContent = row.name;
    if (cards.type === "inventory") detail.textContent = row.color + " / " + row.size + " · " + number(row.quantity) + " left";
    if (cards.type === "products") detail.textContent = number(row.units_sold) + " units sold";
    if (cards.type === "reviews") detail.textContent = number(row.average_rating).toFixed(2) + " / 5 · " + number(row.total_reviews) + " reviews";
    if (cards.type === "orders") {
      name.textContent = row.status;
      detail.textContent = number(row.total) + " orders";
    }
    description.appendChild(name);
    description.appendChild(detail);
    item.appendChild(description);
    if (cards.type === "products" || cards.type === "reviews") addStockButton(item, row.id, row.name, stock);
    if (cards.type === "inventory") {
      detail.textContent = "Size " + row.size + " · " + row.color;
      const badge = document.createElement("span");
      const quantity = Math.max(0, number(row.quantity));
      badge.className = "answer-stock-badge " + stockLevel(quantity);
      badge.textContent = quantity === 0 ? "Out of stock" : quantity + " left";
      item.appendChild(badge);
      addStockButton(item, row.product_id, row.name, stock);
    }
    AdminAnswerView.enhanceRecord(item, row, cards.type);
    panel.appendChild(item);
  }
  article.appendChild(panel);
}

async function sendQuestion(question) {
  question = question.trim();
  if (sendingMessage || loadingInsights || !activePeriod || question === "") return;
  if (Array.from(question).length > 1000) {
    Alerts.show("Question is too long", "Use up to 1,000 characters.", "warning");
    return;
  }

  let period = activePeriod;
  if (!period) {
    try { period = getSelectedPeriod(); }
    catch (error) { Alerts.show("Check the reporting period", error.message, "warning"); return; }
  }
  const history = getConversationHistory();
  addMessage("user", question);
  questionInput.value = "";
  updateCharacterCount();
  const answerArticle = addMessage("assistant", "Preparing an answer from your store data…");
  const answerText = answerArticle.querySelector(".message-text");
  const quote = document.createElement("blockquote");
  quote.className = "answer-question";
  quote.dir = "auto";
  quote.textContent = question;
  answerText.before(quote);
  answerArticle.classList.add("is-preparing");
  scrollToAnswer(answerArticle);
  let streamedText = "";
  sendingMessage = true;
  messageController = new AbortController();
  updateControls();

  try {
    const result = await AdminAPI.askDetails(question, history, period, messageController.signal, function (event) {
      if (event.type === "token") {
        streamedText += event.text;
        answerText.textContent = streamedText;
        answerArticle.classList.remove("is-preparing");
      }
    });
     
    AdminAnswerView.renderText(answerText, result.answer);
    showAnswerDetails(answerArticle, result);
    addAnswerTools(answerArticle, result.answer);
    conversation.push({ role: "user", content: question });
    conversation.push({ role: "assistant", content: Array.from(result.answer).slice(0, 4000).join("") });
    conversation = conversation.slice(-10);
  } catch (error) {
    answerArticle.classList.add("failed");
    if (error.name === "AbortError") {
      answerText.textContent = "Request cancelled. No complete answer was received.";
    } else {
      answerText.textContent = error.message;
      const retry = document.createElement("button");
      retry.className = "secondary retry-question";
      retry.textContent = "Retry question";
      retry.addEventListener("click", function () {
        if (!sendingMessage && !loadingInsights) { retry.disabled = true; sendQuestion(question); }
      });
      answerArticle.appendChild(retry);
    }
  } finally {
    sendingMessage = false;
    answerArticle.classList.remove("is-preparing");
    updateControls();
    questionInput.focus({preventScroll: true});
    updateLatestAnswer();
  }
}

function getList(value) {
  if (Array.isArray(value)) return value;
  return [];
}

async function loadInsights() {
  if (loadingInsights || sendingMessage) return;
  let requestedPeriod;
  try { requestedPeriod = getSelectedPeriod(); }
  catch (error) { Alerts.show("Check the reporting period", error.message, "warning"); return; }

  loadingInsights = true;
  updateControls();
  document.getElementById("insights-error").hidden = true;
  connectionStatus.className = "status";
  connectionStatus.textContent = "Updating";
  try {
    const data = await AdminAPI.insights(requestedPeriod.from, requestedPeriod.to);
    if (!data.period || !data.period.from || !data.period.to) throw new Error("The store did not return a conversation period.");
    if (activePeriod && (activePeriod.from !== data.period.from || activePeriod.to !== data.period.to)) {
      conversation = [];
      messagesBox.innerHTML = "";
      showWelcome();
    }
    activePeriod = data.period;
    document.getElementById("chat-period").textContent = "Reporting: " + data.period.from + " — " + data.period.to + " · Inventory: current";
    document.getElementById("period-draft-note").hidden = true;
    document.getElementById("active-period").textContent = data.period.from + " — " + data.period.to;
    updateLatestAnswer();
    connectionStatus.className = "status ready";
    connectionStatus.textContent = "Up to date";
    document.getElementById("last-updated").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (error) {
    connectionStatus.className = "status hidden";
    connectionStatus.textContent = "Update unavailable";
    document.getElementById("insights-error").hidden = false;
    document.getElementById("insights-error-text").textContent = error.message;
    document.getElementById("last-updated").textContent = "Could not refresh context. The conversation still uses the last loaded period.";
  } finally { loadingInsights = false; updateControls(); }
}

assistantForm.addEventListener("submit", function (event) { event.preventDefault(); sendQuestion(questionInput.value); });
questionInput.addEventListener("input", updateCharacterCount);
questionInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendQuestion(questionInput.value); }
});
cancelButton.addEventListener("click", function () { if (messageController) messageController.abort(); });
for (const button of document.querySelectorAll("[data-question]")) {
  button.addEventListener("click", function () { sendQuestion(button.dataset.question); });
}
clearButton.addEventListener("click", async function () {
  const result = await Alerts.confirm("Clear this conversation?", "This clears the conversation and its follow-up context in this tab.");
  if (result.isConfirmed) { conversation = []; messagesBox.innerHTML = ""; showWelcome(); updateLatestAnswer(); questionInput.focus({preventScroll: true}); }
});
reportingForm.addEventListener("submit", function (event) { event.preventDefault(); loadInsights(); });
periodPreset.addEventListener("change", function () { choosePreset(); showPeriodDraft(); });
fromInput.addEventListener("input", function () { periodPreset.value = "custom"; showPeriodDraft(); });
toInput.addEventListener("input", function () { periodPreset.value = "custom"; showPeriodDraft(); });
refreshInsightsButton.addEventListener("click", loadInsights);
document.getElementById("retry-insights").addEventListener("click", loadInsights);
fromInput.max = getToday();
toInput.max = getToday();
choosePreset();
loadInsights();

function scrollToAnswer(article) {
  messagesBox.scrollTop += article.getBoundingClientRect().top - messagesBox.getBoundingClientRect().top - 16;
}

function updateLatestAnswer() {
  const last = messagesBox.querySelector(".message:last-child");
  document.getElementById("latest-answer").hidden = !last || last.getBoundingClientRect().top < messagesBox.getBoundingClientRect().bottom - 40;
}

function addAnswerTools(article, answer) {
  const tools = document.createElement("div");
  tools.className = "answer-tools";
  const copy = document.createElement("button");
  copy.className = "secondary";
  copy.type = "button";
  copy.innerHTML = fa("copy") + " Copy answer";
  copy.addEventListener("click", async function () {
    try {
      await navigator.clipboard.writeText(answer);
      Alerts.toast("Answer copied");
    } catch (error) {
      Alerts.show("Could not copy", "Select the answer text and copy it manually.", "info");
    }
  });
  tools.appendChild(copy);
  article.appendChild(tools);
}

function showPeriodDraft() {
  document.getElementById("period-draft-note").hidden = !!activePeriod && fromInput.value === activePeriod.from && toInput.value === activePeriod.to;
}

messagesBox.addEventListener("scroll", updateLatestAnswer, {passive: true});
document.getElementById("latest-answer").addEventListener("click", function () {
  const last = messagesBox.querySelector(".message:last-child");
  if (last) scrollToAnswer(last);
  updateLatestAnswer();
});

function showWelcome() {
  document.getElementById("chat-welcome").hidden = false;
  messagesBox.hidden = true;
  document.getElementById("latest-answer").hidden = true;
}
