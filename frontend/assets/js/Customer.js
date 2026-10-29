document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("customersTableBody");
    const searchInput = document.getElementById("searchInput");

    if (!tableBody || !searchInput) {
        console.error("Customer list page is missing required elements.");
        return;
    }

    let allCustomers = [];
    let actionInProgress = false;
    const hiddenCustomersStorageKey = "eco-marc-hidden-customers";
    const hiddenCustomerIds = new Set(
        (localStorage.getItem(hiddenCustomersStorageKey) || "")
            .split(",")
            .filter(id => /^[1-9]\d*$/.test(id))
    );

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
            status.textContent = Number(customer.is_active) === 1 ? "Active" : "Inactive";
            statusCell.appendChild(status);

            viewLink.href =
                `Customer-details.html?id=${encodeURIComponent(customer.id)}`;
            viewLink.textContent = "View";
            viewLink.className = "action-btn view-btn";

            editButton.type = "button";
            editButton.className = "action-btn edit-btn";
            editButton.textContent = "Edit";
            editButton.dataset.action = "edit";
            editButton.dataset.customerId = String(customer.id);
            editButton.setAttribute("aria-label", `Edit ${name.textContent}`);

            deleteButton.type = "button";
            deleteButton.className = "action-btn delete-btn";
            deleteButton.textContent = "Delete";
            deleteButton.dataset.action = "delete";
            deleteButton.dataset.customerId = String(customer.id);
            deleteButton.setAttribute("aria-label", `Delete ${name.textContent}`);

            actions.className = "customer-actions";
            actions.append(viewLink, editButton, deleteButton);

            row.append(customerCell, joined, orders, spent, statusCell, actions);
            tableBody.appendChild(row);
        });
    }

    function filterCustomers() {
        const query = searchInput.value.trim().toLocaleLowerCase();
        const filtered = allCustomers.filter(customer => {
            if (hiddenCustomerIds.has(String(customer.id))) return false;

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
            allCustomers = await AdminAPI.customers();
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

    function customerForm(customer) {
        return `
            <div class="customer-alert-form">
                <label for="customer-first-name">First name</label>
                <input id="customer-first-name" type="text" maxlength="100" required value="${escapeHTML(customer.first_name || "")}">
                <label for="customer-last-name">Last name</label>
                <input id="customer-last-name" type="text" maxlength="100" required value="${escapeHTML(customer.last_name || "")}">
                <label for="customer-email">Email</label>
                <input id="customer-email" type="email" maxlength="255" required value="${escapeHTML(customer.email || "")}">
                <label for="customer-phone">Phone</label>
                <input id="customer-phone" type="tel" maxlength="20" value="${escapeHTML(customer.phone || "")}">
                <label for="customer-address">Address</label>
                <textarea id="customer-address" maxlength="2000" rows="3">${escapeHTML(customer.address || "")}</textarea>
            </div>
        `;
    }

    async function editCustomer(customer) {
        if (actionInProgress) return;
        actionInProgress = true;

        try {
            const result = await Alerts.form("Edit customer", customerForm(customer), async function () {
                const firstName = document.getElementById("customer-first-name");
                const lastName = document.getElementById("customer-last-name");
                const email = document.getElementById("customer-email");
                const phone = document.getElementById("customer-phone");
                const address = document.getElementById("customer-address");

                if (!firstName.value.trim() || !lastName.value.trim() || !email.value.trim()) {
                    Alerts.validation("First name, last name and email are required.");
                    return false;
                }
                if (!email.checkValidity()) {
                    Alerts.validation("Enter a valid email address.");
                    return false;
                }

                try {
                    return await AdminAPI.updateCustomer(customer.id, {
                        first_name: firstName.value.trim(),
                        last_name: lastName.value.trim(),
                        email: email.value.trim(),
                        phone: phone.value.trim(),
                        address: address.value.trim()
                    });
                } catch (error) {
                    Alerts.validation(error.message);
                    return false;
                }
            });

            if (result.isConfirmed) {
                Alerts.toast("Customer updated successfully");
                await loadCustomers();
            }
        } finally {
            actionInProgress = false;
        }
    }

    async function deleteCustomer(customer) {
        if (actionInProgress) return;
        const name = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
        const confirmation = await Alerts.confirm(
            "Hide this customer from the page?",
            `${name || customer.email} will be hidden on this browser only. The customer record in the database will not change.`
        );
        if (!confirmation.isConfirmed) return;

        actionInProgress = true;
        try {
            hiddenCustomerIds.add(String(customer.id));
            localStorage.setItem(
                hiddenCustomersStorageKey,
                Array.from(hiddenCustomerIds).join(",")
            );
            filterCustomers();
            Alerts.toast("Customer hidden on this browser");
        } catch (error) {
            hiddenCustomerIds.delete(String(customer.id));
            Alerts.show(
                "Customer could not be hidden",
                error.message || "Browser storage is unavailable. The database was not changed.",
                "error"
            );
        } finally {
            actionInProgress = false;
        }
    }

    tableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action][data-customer-id]");
        if (!button || !tableBody.contains(button)) return;

        const customer = allCustomers.find(function (item) {
            return String(item.id) === button.dataset.customerId;
        });
        if (!customer) return;

        if (button.dataset.action === "edit") {
            editCustomer(customer);
        } else if (button.dataset.action === "delete") {
            deleteCustomer(customer);
        }
    });

    loadCustomers();
});
