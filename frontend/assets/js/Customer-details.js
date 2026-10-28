document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get("id");
    const nameElement = document.getElementById("customerName");
    const ordersBody = document.getElementById("customerOrdersBody");

    if (!customerId || !/^[1-9]\d*$/.test(customerId)) {
        nameElement.textContent = "Invalid customer ID.";
        return;
    }

    const apiUrl = new URL("../../backend/api/Customer.php", window.location.href);
    apiUrl.searchParams.set("id", customerId);

    async function loadCustomerDetails() {
        try {
            const response = await fetch(apiUrl, {
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
            const result = await response.json();

            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.message || `Request failed (${response.status}).`);
            }

            const customer = result.data;
            nameElement.textContent =
                `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "—";
            document.getElementById("customerId").textContent = customer.id ?? "—";
            document.getElementById("customerEmail").textContent = customer.email || "—";
            document.getElementById("customerPhone").textContent = customer.phone || "—";
            document.getElementById("customerAddress").textContent = customer.address || "—";
            document.getElementById("customerJoined").textContent = customer.created_at
                ? new Date(customer.created_at).toLocaleDateString()
                : "—";
            document.getElementById("totalOrders").textContent =
                String(customer.orders ?? 0);
            document.getElementById("customerSpent").textContent =
                `JOD ${Number(customer.total_spent ?? 0).toFixed(2)}`;
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 4;
            cell.textContent =
                "Detailed order history is not available from the current API.";
            row.appendChild(cell);
            ordersBody.replaceChildren(row);
        } catch (error) {
            console.error("Error loading customer details:", error);
            nameElement.textContent = error instanceof Error
                ? `Unable to load customer: ${error.message}`
                : "Unable to load customer.";
        }
    }

    loadCustomerDetails();
});
