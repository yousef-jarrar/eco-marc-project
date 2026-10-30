// Eco Marc - My Orders page (customer)
// Read-only list. No order details navigation.

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
    pending: "#b26a00",
    confirmed: "#1565c0",
    processing: "#1565c0",
    shipped: "#6a1b9a",
    delivered: "#2e7d32",
    cancelled: "#c62828"
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

        // No click event: rows are not clickable.
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