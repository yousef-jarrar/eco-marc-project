document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("customersTableBody");
    const searchInput = document.getElementById("searchInput");

    if (!tableBody || !searchInput) {
        console.error("Customer list page is missing required elements.");
        return;
    }

    const apiUrl = new URL("../../backend/api/Customer.php", window.location.href);
    let allCustomers = [];

    function renderCustomers(customers) {
        tableBody.replaceChildren();

        if (customers.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 6;
            cell.textContent = allCustomers.length === 0
                ? "No customers found."
                : "No customers match your search.";
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        customers.forEach(customer => {
            const row = document.createElement("tr");
            const customerCell = document.createElement("td");
            const name = document.createElement("div");
            const email = document.createElement("div");
            const joined = document.createElement("td");
            const orders = document.createElement("td");
            const spent = document.createElement("td");
            const statusCell = document.createElement("td");
            const actions = document.createElement("td");
            const viewLink = document.createElement("a");
            const editButton = document.createElement("button");
            const deleteButton = document.createElement("button");

            name.className = "customer-name";
            name.textContent =
                `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "—";
            email.textContent = customer.email || "—";
            email.className = "customer-email";
            customerCell.appendChild(name);
            customerCell.appendChild(email);

            joined.textContent = customer.created_at
                ? new Date(customer.created_at).toLocaleDateString()
                : "—";
            orders.textContent = String(customer.orders ?? 0);
            spent.textContent = `JOD ${Number(customer.total_spent ?? 0).toFixed(2)}`;

            const status = document.createElement("span");
            status.className = "status-badge";
            status.textContent = "Active";
            statusCell.appendChild(status);

            viewLink.href =
                `Customer-details.html?id=${encodeURIComponent(customer.id)}`;
            viewLink.textContent = "View";
            viewLink.className = "action-btn view-btn";

            editButton.type = "button";
            editButton.className = "action-btn edit-btn";
            editButton.textContent = "Edit";
            editButton.disabled = true;
            editButton.title = "Customer editing is not available in this page yet.";

            deleteButton.type = "button";
            deleteButton.className = "action-btn delete-btn";
            deleteButton.textContent = "Delete";
            deleteButton.disabled = true;
            deleteButton.title = "Customer deletion requires the admin CSRF token.";

            actions.className = "customer-actions";
            actions.append(viewLink, editButton, deleteButton);

            row.append(customerCell, joined, orders, spent, statusCell, actions);
            tableBody.appendChild(row);
        });
    }

    function filterCustomers() {
        const query = searchInput.value.trim().toLocaleLowerCase();
        const filtered = allCustomers.filter(customer => {
            const searchable = [
                customer.first_name,
                customer.last_name,
                customer.email
            ].filter(Boolean).join(" ").toLocaleLowerCase();

            return searchable.includes(query);
        });

        renderCustomers(filtered);
    }

    searchInput.addEventListener("input", filterCustomers);

    async function loadCustomers() {
        try {
            const response = await fetch(apiUrl, {
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
            const result = await response.json();

            if (!response.ok || !result.success || !Array.isArray(result.data)) {
                throw new Error(result.message || `Request failed (${response.status}).`);
            }

            allCustomers = result.data;
            filterCustomers();
        } catch (error) {
            console.error("Error loading customers:", error);
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 6;
            cell.textContent = error instanceof Error
                ? `Unable to load customers: ${error.message}`
                : "Unable to load customers.";
            row.appendChild(cell);
            tableBody.replaceChildren(row);
            Alerts.show("Customers could not load", error.message || "Please retry.", "error");
        }
    }

    loadCustomers();
});
