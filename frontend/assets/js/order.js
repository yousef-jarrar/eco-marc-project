const API_URL = "http://localhost/eco-marc-project-main/backend/api/cart.php";

const form = document.getElementById("order-filters");
const usernameInput = document.getElementById("username");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const resetButton = document.getElementById("reset-btn");

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
const limit = 10;

// Temporary test user ID. Replace with the logged-in admin's ID.
const userId = 1;

function showState(state, message = "") {
    loadingMessage.hidden = state !== "loading";
    errorMessage.hidden = state !== "error";
    emptyMessage.hidden = state !== "empty";
    ordersContent.hidden = state !== "content";

    if (state === "error") {
        errorText.textContent = message || "Could not load orders.";
    }
}

const money = value => Number(value ?? 0).toFixed(2);

async function loadOrders() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (startDate && endDate && startDate > endDate) {
        showState("error", "Start date cannot be after end date.");
        return;
    }

    showState("loading");
    ordersCount.textContent = "";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                action: "latest",
                username: usernameInput.value.trim(),
                start_date: startDate || null,
                end_date: endDate || null,
                page: currentPage,
                limit: limit
            })
        });

        const responseText = await response.text();
        if (!responseText.trim()) throw new Error("The API returned an empty response.");

        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            throw new Error("The API did not return valid JSON.");
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to load orders.");
        }

        const orders = Array.isArray(result.data) ? result.data : [];

        pageNumber.textContent = `Page ${currentPage}`;
        previousButton.disabled = currentPage <= 1;
        nextButton.disabled = orders.length < limit;

        if (orders.length === 0) {
            showState("empty");
            if (currentPage > 1) {
                // keep Previous reachable after paging past the last page
                ordersContent.hidden = false;
                tableBody.replaceChildren();
            }
            return;
        }

        renderOrders(orders);
        ordersCount.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"} on this page`;
        showState("content");
    } catch (error) {
        console.error("Load orders error:", error);
        showState("error", error.message);
    }
}

function renderOrders(orders) {
    tableBody.replaceChildren();

    orders.forEach(order => {
        const row = document.createElement("tr");

        const values = [
            order.order_id,
            order.customer_name,
            order.placed_at,
            null, // status badge
            money(order.subtotal),
            money(order.discount_amount),
            money(order.delivery_fee),
            money(order.total)
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");

            if (index === 3) {
                const badge = document.createElement("span");
                badge.className = `status ${String(order.status).toLowerCase()}`;
                badge.textContent = order.status;
                cell.appendChild(badge);
            } else {
                cell.textContent = value ?? "";
            }

            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "secondary";
        viewButton.textContent = "View";
        viewButton.addEventListener("click", () => {
            window.location.href =
                `order-details.html?id=${encodeURIComponent(order.order_id)}`;
        });

        actionCell.appendChild(viewButton);
        row.appendChild(actionCell);
        tableBody.appendChild(row);
    });
}

form.addEventListener("submit", event => {
    event.preventDefault();
    currentPage = 1;
    loadOrders();
});

resetButton.addEventListener("click", () => {
    form.reset();
    currentPage = 1;
    loadOrders();
});

retryButton.addEventListener("click", loadOrders);

previousButton.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        loadOrders();
    }
});

nextButton.addEventListener("click", () => {
    currentPage++;
    loadOrders();
});

loadOrders();