const API_URL = new URL("../../backend/api/cart.php", location.href).href;
const form = document.getElementById("order-filters");
const usernameInput = document.getElementById("username");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const statusInput = document.getElementById("order-status");
const tableBody = document.getElementById("orders-table");
let currentPage = 1;
let pageSize = 10;
let loadingOrders = false;
let hasNextPage = false;
let appliedFilters = {username: "", start_date: null, end_date: null, status: null};
const statusLabels = {pending: "Pending", confirmed: "Confirmed", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled"};
const statusIcons = {pending: "clock", confirmed: "check", processing: "box", shipped: "truck-fast", delivered: "circle-check", cancelled: "ban"};
const orderMoney = value => "JOD " + Number(value || 0).toFixed(2);

function currentFilters() {
    return {username: usernameInput.value.trim(), start_date: startDateInput.value || null, end_date: endDateInput.value || null, status: statusInput.value || null};
}

function setOrderState(state, message = "") {
    document.getElementById("loading-message").hidden = state !== "loading";
    document.getElementById("error-message").hidden = state !== "error";
    document.getElementById("empty-message").hidden = state !== "empty";
    document.getElementById("orders-content").hidden = state !== "content";
    document.getElementById("error-text").textContent = message;
}

function setOrderBusy(busy) {
    loadingOrders = busy;
    document.querySelector(".orders-list-panel").setAttribute("aria-busy", String(busy));
    document.querySelectorAll("#order-filters input,#order-filters select,#order-filters button,[data-order-status],#refresh-orders,#retry-button,#orders-limit,#empty-reset").forEach(control => control.disabled = busy);
    document.getElementById("previous-btn").disabled = busy || currentPage <= 1;
    document.getElementById("next-btn").disabled = busy || !hasNextPage;
    document.getElementById("refresh-orders").innerHTML = fa(busy ? "spinner fa-spin" : "rotate") + (busy ? " Updating…" : " Refresh");
}

function describeFilters() {
    const parts = [statusLabels[appliedFilters.status] || "All orders"];
    if (appliedFilters.username) parts.push('Matching “' + appliedFilters.username + '”');
    parts.push(appliedFilters.start_date || appliedFilters.end_date ? (appliedFilters.start_date || "Any start") + " — " + (appliedFilters.end_date || "No end date") : "All dates");
    document.getElementById("active-order-filters").textContent = parts.join(" · ");
    document.querySelectorAll("[data-order-status]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.orderStatus === (appliedFilters.status || ""))));
}

async function loadOrders() {
    if (loadingOrders) return;
    setOrderBusy(true);
    setOrderState("loading");
    document.getElementById("orders-count").textContent = "Loading…";
    try {
        const response = await EcoAuth.fetch(API_URL, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "latest", ...appliedFilters, page: currentPage, limit: pageSize, lookahead: true})});
        let result;
        try { result = await response.json(); } catch (error) { throw new Error("The server returned an unexpected response. Please retry."); }
        if (!response.ok || result.success !== true || !Array.isArray(result.data)) throw new Error(result.message || "Orders could not load. Please retry.");
        const rows = result.data.slice(0, pageSize);
        hasNextPage = result.data.length > pageSize;
        renderOrders(rows);
        setOrderState(rows.length ? "content" : "empty");
        const start = rows.length ? (currentPage - 1) * pageSize + 1 : 0;
        document.getElementById("page-number").textContent = rows.length ? start + "–" + (start + rows.length - 1) + " shown · Page " + currentPage : "No orders on page " + currentPage;
        document.getElementById("orders-count").textContent = rows.length + (rows.length === 1 ? " order on this page" : " orders on this page");
        document.getElementById("orders-updated").textContent = "Updated " + new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
        describeFilters();
    } catch (error) {
        hasNextPage = false;
        setOrderState("error", error.message);
        document.getElementById("orders-count").textContent = "Unavailable";
        document.getElementById("page-number").textContent = "Could not load page " + currentPage;
    } finally { setOrderBusy(false); }
}

function renderOrders(orders) {
    tableBody.replaceChildren();
    for (const order of orders) {
        const row = document.createElement("tr");
        row.dataset.orderId = order.order_id;
        const status = Object.hasOwn(statusLabels, order.status) ? order.status : "unknown";
        const date = new Date(String(order.placed_at || "").replace(" ", "T"));
        const dateLabel = Number.isNaN(date.getTime()) ? String(order.placed_at || "Not provided") : date.toLocaleDateString("en-GB", {day: "2-digit", month: "short", year: "numeric"});
        const timeLabel = Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
        const link = "order-details.html?id=" + encodeURIComponent(order.order_id);
        row.innerHTML = `<td data-label="Order"><a class="order-id-link" href="${link}">#${escapeHTML(order.order_id)}</a><small class="order-record-label">Customer order</small></td>
          <td data-label="Customer"><strong class="order-customer-name">${escapeHTML(order.customer_name || "Customer")}</strong><span class="order-customer-email">${escapeHTML(order.customer_email || "")}</span></td>
          <td data-label="Placed"><span class="order-date">${escapeHTML(dateLabel)}</span><small class="order-time">${escapeHTML(timeLabel)}</small></td>
          <td data-label="Status"><span class="order-status ${status}">${fa(statusIcons[status] || "circle-question")}${statusLabels[status] || "Unknown"}</span></td>
          <td data-label="Total"><strong class="order-total">${orderMoney(order.total)}</strong><details class="order-costs"><summary>Cost breakdown</summary><dl><div><dt>Subtotal</dt><dd>${orderMoney(order.subtotal)}</dd></div><div><dt>Discount</dt><dd>− ${orderMoney(order.discount_amount)}</dd></div><div><dt>Delivery</dt><dd>${orderMoney(order.delivery_fee)}</dd></div></dl></details></td>
          <td data-label="Details"><a class="view-order-btn" href="${link}" aria-label="View order ${escapeHTML(order.order_id)}">${fa("arrow-up-right-from-square")}<span>View order</span></a></td>`;
        tableBody.appendChild(row);
    }
}

function markOrderDraft() {
    document.getElementById("order-filter-draft").hidden = JSON.stringify(currentFilters()) === JSON.stringify(appliedFilters);
    document.getElementById("order-filter-error").hidden = true;
    startDateInput.removeAttribute("aria-invalid");
    endDateInput.removeAttribute("aria-invalid");
}

function applyOrderFilters() {
    if (loadingOrders) return;
    const filters = currentFilters();
    const error = document.getElementById("order-filter-error");
    if (!form.checkValidity() || (filters.start_date && filters.end_date && filters.start_date > filters.end_date)) {
        error.textContent = "Choose valid dates with the start on or before the end date.";
        error.hidden = false;
        startDateInput.setAttribute("aria-invalid", "true");
        startDateInput.focus();
        return;
    }
    error.hidden = true;
    appliedFilters = filters;
    currentPage = 1;
    document.getElementById("order-filter-draft").hidden = true;
    loadOrders();
}

function resetOrderFilters() {
    form.reset();
    applyOrderFilters();
}
form.addEventListener("submit", event => {event.preventDefault(); applyOrderFilters();});
for (const input of [usernameInput, statusInput, startDateInput, endDateInput]) input.addEventListener("input", markOrderDraft);
document.getElementById("reset-btn").addEventListener("click", resetOrderFilters);
document.getElementById("empty-reset").addEventListener("click", resetOrderFilters);
document.getElementById("retry-button").addEventListener("click", loadOrders);
document.getElementById("refresh-orders").addEventListener("click", loadOrders);
document.querySelectorAll("[data-order-status]").forEach(button => button.addEventListener("click", () => {statusInput.value = button.dataset.orderStatus; applyOrderFilters();}));
document.getElementById("orders-limit").addEventListener("change", event => {pageSize = Number(event.target.value); currentPage = 1; loadOrders();});
document.getElementById("previous-btn").addEventListener("click", () => {if (!loadingOrders && currentPage > 1) {currentPage--; loadOrders();}});
document.getElementById("next-btn").addEventListener("click", () => {if (!loadingOrders && hasNextPage) {currentPage++; loadOrders();}});
loadOrders();
