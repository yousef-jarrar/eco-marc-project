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
let revenueChart = null;
let conversation = [];
let activePeriod = null;
let currentStock = [];

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
  sendButton.disabled = busy;
  refreshInsightsButton.disabled = busy;
  clearButton.disabled = sendingMessage;
  cancelButton.hidden = !sendingMessage;
  assistantForm.setAttribute("aria-busy", String(sendingMessage));

  for (const button of document.querySelectorAll("[data-question]")) button.disabled = busy;
  for (const control of reportingForm.querySelectorAll("input, select, button")) control.disabled = busy;
}

function addMessage(role, message, failed = false) {
  const article = document.createElement("article");
  article.className = "message " + role;
  if (failed) article.classList.add("failed");

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = "Eco Marc Business Assistant";
  if (role === "user") label.textContent = "You";

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = message;
  text.dir = "auto";
  article.appendChild(label);
  article.appendChild(text);
  messagesBox.appendChild(article);
  messagesBox.scrollTop = messagesBox.scrollHeight;
  return article;
}

function updateCharacterCount() {
  document.getElementById("character-count").textContent = Array.from(questionInput.value).length + " / 1000";
}

// نرسل آخر عدة رسائل فقط، ولا نرسل رسائل النظام أو الأخطاء.
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

function showStockDetails(productId, productName, stock) {
  const lines = [];
  for (const variant of stock) {
    if (Number(variant.product_id) === Number(productId)) {
      lines.push(variant.color + " / " + variant.size + ": " + number(variant.quantity) + " units");
    }
  }
  if (lines.length === 0) lines.push("No stock details were returned for this product.");
  Alerts.show(productName + " — current stock", lines.join("\n"));
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
  button.textContent = "Stock details";
  button.addEventListener("click", function () {
    showStockDetails(productId, productName, stock);
  });
  container.appendChild(button);
}

function showAnswerDetails(article, result) {
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
    if (cards.type === "reviews") detail.textContent = number(row.average_rating).toFixed(2) + " / 5 · " + number(row.total_reviews) + " approved reviews";
    if (cards.type === "orders") {
      name.textContent = row.status;
      detail.textContent = number(row.total) + " orders";
    }
    description.appendChild(name);
    description.appendChild(detail);
    item.appendChild(description);
    if (cards.type === "products" || cards.type === "reviews") addStockButton(item, row.id, row.name, stock);
    panel.appendChild(item);
  }
  article.appendChild(panel);
}

async function sendQuestion(question) {
  question = question.trim();
  if (sendingMessage || loadingInsights || question === "") return;
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
  let streamedText = "";
  sendingMessage = true;
  messageController = new AbortController();
  updateControls();

  try {
    const result = await AdminAPI.askDetails(question, history, period, messageController.signal, function (event) {
      if (event.type === "token") {
        streamedText += event.text;
        answerText.textContent = streamedText;
        messagesBox.scrollTop = messagesBox.scrollHeight;
      }
    });
    // الرد النهائي يستبدل أي جزء غير مكتمل إذا توقفت خدمة AI.
    answerText.textContent = result.answer;
    showAnswerDetails(answerArticle, result);
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
    updateControls();
    questionInput.focus();
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }
}

function getList(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function showEmptyList(list, message) {
  const item = document.createElement("li");
  item.className = "muted";
  item.textContent = message;
  list.appendChild(item);
}

function showTopProducts(products) {
  const list = document.getElementById("top-products");
  list.innerHTML = "";
  if (products.length === 0) { showEmptyList(list, "No eligible product sales in this period."); return; }
  for (const product of products) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${escapeHTML(product.name)}</span><strong>${number(product.units_sold)} units</strong>`;
    list.appendChild(item);
  }
}

function showLowStock(products, totalCount) {
  const list = document.getElementById("low-stock");
  list.innerHTML = "";
  let note = "Current inventory · 5 or fewer units.";
  if (totalCount > 8) note = "Current inventory · showing 8 of " + totalCount + " variants.";
  document.getElementById("stock-count-note").textContent = note;
  if (products.length === 0) { showEmptyList(list, "No current variants at or below 5 units."); return; }
  for (const product of products.slice(0, 8)) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${escapeHTML(product.name)}<small>${escapeHTML(product.color)} / ${escapeHTML(product.size)}</small></span><strong>${number(product.quantity)} left</strong>`;
    list.appendChild(item);
  }
}

function showProductRatings(products) {
  const list = document.getElementById("product-ratings");
  list.innerHTML = "";
  if (products.length === 0) { showEmptyList(list, "No approved reviews in this period."); return; }
  for (const product of products) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${escapeHTML(product.name)}<small>${number(product.total_reviews)} approved reviews</small></span><strong>${number(product.average_rating).toFixed(2)} / 5</strong>`;
    list.appendChild(item);
  }
}

function showDailyRevenue(rows) {
  const tableBody = document.getElementById("daily-body");
  const canvas = document.getElementById("daily-chart");
  const emptyMessage = document.getElementById("daily-chart-empty");
  tableBody.innerHTML = "";
  if (revenueChart) { revenueChart.destroy(); revenueChart = null; }
  if (rows.length === 0) {
    canvas.hidden = true;
    emptyMessage.hidden = false;
    emptyMessage.textContent = "No eligible revenue records in this period.";
    tableBody.innerHTML = '<tr><td colspan="3">No eligible revenue records were returned for this period.</td></tr>';
    return;
  }

  const dates = [];
  const amounts = [];
  for (const row of rows) {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `<td>${escapeHTML(displayDate(row.sale_date))}</td><td>${number(row.total_orders)}</td><td>${formatJOD(row.revenue)}</td>`;
    tableBody.appendChild(tableRow);
    dates.push(displayDate(row.sale_date));
    amounts.push(number(row.revenue));
  }
  if (!window.Chart) {
    canvas.hidden = true;
    emptyMessage.hidden = false;
    emptyMessage.textContent = "The chart is unavailable. Records are shown in the table.";
    return;
  }
  canvas.hidden = false;
  emptyMessage.hidden = true;
  revenueChart = new Chart(canvas, {
    type: "line",
    data: { labels: dates, datasets: [{ label: "Revenue (JOD)", data: amounts, borderColor: "#b89569", backgroundColor: "#b8956920", borderWidth: 2, fill: true, tension: 0.25 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: "#eeeeee" } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } }
    }
  });
}

function showChange(id, comparison) {
  const element = document.getElementById(id);
  element.className = "metric-change";
  element.textContent = "Comparison unavailable";
  if (!comparison) return;
  if (comparison.percent === null) {
    element.textContent = "No percentage comparison: previous value was zero";
    return;
  }
  const change = number(comparison.percent);
  if (change > 0) {
    element.classList.add("up");
    element.textContent = "+" + change.toFixed(2) + "% vs previous period";
  } else if (change < 0) {
    element.classList.add("down");
    element.textContent = change.toFixed(2) + "% vs previous period";
  } else element.textContent = "Unchanged vs previous period";
}

function showSummary(data) {
  const summary = data.summary;
  document.getElementById("revenue-value").textContent = formatJOD(summary.revenue);
  document.getElementById("orders-value").textContent = number(summary.total_orders);
  document.getElementById("pending-value").textContent = number(summary.pending_orders);
  document.getElementById("stock-value").textContent = number(data.low_stock_count);
  document.getElementById("average-order-value").textContent = formatJOD(summary.average_order_value);
  document.getElementById("customers-value").textContent = number(summary.customers);
  showChange("revenue-change", data.comparison.revenue);
  showChange("orders-change", data.comparison.total_orders);
  showChange("average-change", data.comparison.average_order_value);
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
    if (!data.summary || !data.period || !data.comparison) throw new Error("The store returned an incomplete report.");
    if (activePeriod && (activePeriod.from !== data.period.from || activePeriod.to !== data.period.to)) {
      conversation = [];
      messagesBox.innerHTML = "";
      addMessage("assistant", "The reporting period changed. Let’s start a fresh conversation about these dates.");
    }
    activePeriod = data.period;
    currentStock = getList(data.product_stock);
    showSummary(data);
    showTopProducts(getList(data.top_selling_products));
    showLowStock(getList(data.low_stock_products), number(data.low_stock_count));
    showProductRatings(getList(data.lowest_rated_products));
    showDailyRevenue(getList(data.daily_revenue));
    const label = data.period.from + " — " + data.period.to;
    document.getElementById("active-period").textContent = "Showing " + label + " · Asia/Amman";
    document.getElementById("daily-period-label").textContent = label;
    document.getElementById("comparison-period").textContent = "Compared with " + data.period.previous_from + " — " + data.period.previous_to;
    connectionStatus.className = "status ready";
    connectionStatus.textContent = "Up to date";
    document.getElementById("last-updated").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (error) {
    connectionStatus.className = "status hidden";
    connectionStatus.textContent = "Update unavailable";
    document.getElementById("insights-error").hidden = false;
    document.getElementById("insights-error-text").textContent = error.message;
    document.getElementById("last-updated").textContent = "Could not refresh. Any figures shown are from the last successful report.";
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
  if (result.isConfirmed) { conversation = []; messagesBox.innerHTML = ""; addMessage("assistant", "A fresh start. Ask about revenue, orders, inventory or customer reviews."); }
});
reportingForm.addEventListener("submit", function (event) { event.preventDefault(); loadInsights(); });
periodPreset.addEventListener("change", choosePreset);
fromInput.addEventListener("input", function () { periodPreset.value = "custom"; });
toInput.addEventListener("input", function () { periodPreset.value = "custom"; });
refreshInsightsButton.addEventListener("click", loadInsights);
document.getElementById("retry-insights").addEventListener("click", loadInsights);
fromInput.max = getToday();
toInput.max = getToday();
choosePreset();
loadInsights();
