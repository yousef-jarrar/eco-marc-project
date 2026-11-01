

const API_URL = new URL("../../backend/api/cart.php", location.href);
const CURRENCY = "JOD";
const PAGE_SIZE = 10;

const tableBody = document.getElementById("orders-table");
const pageNumber = document.getElementById("page-number");
const ordersCount = document.getElementById("orders-count");
const previousButton = document.getElementById("previous-btn");
const nextButton = document.getElementById("next-btn");

const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const emptyMessage = document.getElementById("empty-message");
const ordersContent = document.getElementById("orders-content");
const retryButton = document.getElementById("retry-button");

let currentPage = 1;

const STATUS_COLORS = {
    pending: "var(--color-warning)",
    confirmed: "var(--color-primary)",
    processing: "var(--color-primary)",
    shipped: "var(--color-text-muted)",
    delivered: "var(--color-success)",
    cancelled: "var(--color-error)"
};

function showState(state, message = "") {
    loadingMessage.hidden = state !== "loading";
    errorMessage.hidden = state !== "error";
    emptyMessage.hidden = state !== "empty";
    ordersContent.hidden = state !== "content";

    if (state === "error") {
        errorText.textContent = message || "Could not load your orders.";
    }
}

const money = value =>
    `${CURRENCY} ${(Number(value) || 0).toFixed(2)}`;

function formatDate(value) {
    if (!value) return "";

    const date = new Date(String(value).replace(" ", "T"));

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
}

function renderOrders(orders) {
    tableBody.replaceChildren();

    orders.forEach(order => {
        const row = document.createElement("tr");

        const status = String(order.status || "").toLowerCase();
        const delivery = Number(order.delivery_fee) || 0;

        const cells = [
            `#${order.order_id}`,
            formatDate(order.placed_at),
            null,
            money(order.subtotal),
            `− ${money(order.discount_amount)}`,
            delivery === 0 ? "Free" : money(delivery),
            money(order.total)
        ];

        cells.forEach((value, index) => {
            const cell = document.createElement("td");

            if (index === 2) {
                const badge = document.createElement("span");

                badge.textContent = status
                    ? status.charAt(0).toUpperCase() + status.slice(1)
                    : "";

                badge.style.fontWeight = "600";
                badge.style.color = STATUS_COLORS[status] || "inherit";

                cell.appendChild(badge);
            } else {
                cell.textContent = value;
            }

            cell.dataset.label = ["Order", "Date", "Status", "Subtotal", "Discount", "Delivery", "Total"][index];
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        actionCell.dataset.label = "Details";
        const details = document.createElement("button");
        details.type = "button";
        details.className = "customer-order-details-button";
        details.dataset.orderDetails = String(order.order_id);
        details.textContent = "View details";
        details.setAttribute("aria-label", "View order #" + order.order_id + " details");
        actionCell.append(details);
        row.append(actionCell);
        tableBody.appendChild(row);
    });
}

async function loadOrders() {
    showState("loading");
    ordersCount.textContent = "";

    try {
        await EcoAuth.ready;
        const url = new URL(API_URL);

        url.searchParams.set("action", "my_orders");
        url.searchParams.set("page", currentPage);

        const fetchFunction =
            EcoAuth.fetch;

        const response = await fetchFunction(url.href, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error("The server did not return valid JSON.");
        }

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Failed to load your orders."
            );
        }

        const orders = Array.isArray(result.data)
            ? result.data
            : [];

        pageNumber.textContent = `Page ${currentPage}`;

        previousButton.disabled = currentPage <= 1;
        nextButton.disabled = orders.length < PAGE_SIZE;

        if (orders.length === 0) {
            if (currentPage > 1) {
                currentPage--;
                return loadOrders();
            }

            showState("empty");
            return;
        }

        renderOrders(orders);

        ordersCount.textContent =
            `${orders.length} order${orders.length === 1 ? "" : "s"} on this page`;

        showState("content");

    } catch (error) {
        console.error("Load orders error:", error);
        showState("error", error.message);
        Alerts.show("Orders unavailable", error.message, "error");
    }
}

// Retry
retryButton.addEventListener("click", loadOrders);

// Previous page
previousButton.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        loadOrders();
    }
});

// Next page
nextButton.addEventListener("click", () => {
    currentPage++;
    loadOrders();
});

// Initial load
loadOrders();

function orderNode(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderCustomerOrder(order) {
    const content = orderNode("div", "customer-order-details");
    const status = String(order.status || "").toLowerCase();
    const meta = orderNode("div", "customer-order-meta");
    const badge = orderNode("strong", "customer-order-status", status.charAt(0).toUpperCase() + status.slice(1));
    badge.style.color = STATUS_COLORS[status] || "var(--color-text)";
    meta.append(badge, orderNode("span", "", formatDate(order.placed_at)));
    content.append(meta);
    const items = orderNode("ul", "customer-order-items");
    (Array.isArray(order.items) ? order.items : []).forEach(item => {
        const row = orderNode("li", "customer-order-item");
        const media = orderNode("span", "customer-order-photo");
        const fallback = orderNode("i", "fa-regular fa-image"); fallback.setAttribute("aria-hidden", "true");
        media.append(fallback);
        if (item.product_image) {
            const image = orderNode("img"); image.alt = item.product_name || "Product"; image.width = 64; image.height = 80;
            image.addEventListener("error", () => { image.remove(); fallback.hidden = false; });
            try {
                const root = new URL("../../", location.href);
                const base = /^(frontend|backend|assets)\//.test(item.product_image) ? root : location.href;
                const url = new URL(item.product_image, base);
                if (["http:", "https:"].includes(url.protocol)) { image.src = url.href; fallback.hidden = true; media.append(image); }
            } catch {}
        }
        const copy = orderNode("div", "customer-order-item-copy");
        const link = orderNode("a", "", item.product_name || "Product");
        link.href = "../ProductShop.html?id=" + encodeURIComponent(item.product_id);
        copy.append(link, orderNode("p", "", [item.size && "Size: " + item.size, item.color && "Color: " + item.color].filter(Boolean).join(" · ")));
        row.append(media, copy, orderNode("span", "customer-order-quantity", "Qty: " + (Number(item.quantity) || 0)));
        items.append(row);
    });
    content.append(orderNode("h3", "", "Ordered items"), items);
    if (!items.children.length) content.append(orderNode("p", "", "Item details are unavailable for this order."));
    const address = orderNode("section", "customer-order-address");
    address.append(orderNode("h3", "", "Delivery address"), orderNode("p", "", order.shipping_address || "No delivery address recorded."));
    content.append(address);
    const totals = orderNode("dl", "customer-order-totals");
    [["Subtotal", money(order.subtotal)], ["Discount", "− " + money(order.discount_amount)], ["Delivery", Number(order.delivery_fee) === 0 ? "Free" : money(order.delivery_fee)], ["Total", money(order.total)]].forEach(([label, amount]) => {
        const row = orderNode("div"); row.append(orderNode("dt", "", label), orderNode("dd", "", amount)); totals.append(row);
    });
    content.append(totals);
    return content;
}

let activeOrderDetailsController = null;

async function openOrderDetails(id) {
    if (!/^\d+$/.test(String(id)) || Number(id) < 1) return;
    activeOrderDetailsController?.abort();
    const controller = new AbortController();
    activeOrderDetailsController = controller;
    const loading = orderNode("p", "customer-order-loading", "Loading your order…"); loading.setAttribute("role", "status");
    Alerts.show("Order #" + id, "", "info", {icon:undefined, html:loading, width:760, customClass:{popup:"customer-order-dialog"}, showConfirmButton:false, showCloseButton:true, didClose:() => controller.abort()});
    try {
        await EcoAuth.ready;
        if (controller.signal.aborted) return;
        const url = new URL(API_URL); url.searchParams.set("action", "my_order_details"); url.searchParams.set("order_id", id);
        const response = await EcoAuth.fetch(url.href, {signal:controller.signal, headers:{Accept:"application/json"}});
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Could not load this order.");
        if (controller !== activeOrderDetailsController || controller.signal.aborted || !Swal.getPopup()?.classList.contains("customer-order-dialog")) return;
        Swal.getHtmlContainer().replaceChildren();
        Swal.update({html:renderCustomerOrder(result.data), showConfirmButton:true, confirmButtonText:"Close"});
    } catch (error) {
        if (controller !== activeOrderDetailsController || controller.signal.aborted || !Swal.getPopup()?.classList.contains("customer-order-dialog")) return;
        const content = orderNode("div", "customer-order-error");
        content.append(orderNode("p", "", error instanceof SyntaxError ? "The server returned an invalid response. Please try again." : error.message || "Could not load this order."));
        const retry = orderNode("button", "secondary", "Try again"); retry.type = "button"; retry.addEventListener("click", () => openOrderDetails(id)); content.append(retry);
        Swal.getHtmlContainer().replaceChildren();
        Swal.update({html:content, showConfirmButton:true, confirmButtonText:"Close"});
    }
}

tableBody.addEventListener("click", event => {
    const button = event.target.closest("[data-order-details]");
    if (button) openOrderDetails(button.dataset.orderDetails);
});
