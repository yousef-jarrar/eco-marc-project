document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("customersTableBody");
    const searchInput = document.getElementById("searchInput");
    const contactFilter = document.getElementById("customerContactFilter");
    const sortInput = document.getElementById("customerSort");
    let allCustomers = [];
    let currentPage = 1;
    let pageSize = 10;
    let customerView = "";
    let loadingCustomers = false;
    let actionInProgress = false;
    const fullName = customer => [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Customer";
    const money = value => "JOD " + Number(value || 0).toFixed(2);

    function setCustomerBusy() {
        const busy = loadingCustomers || actionInProgress;
        document.querySelector(".customer-table-panel").setAttribute("aria-busy", String(busy));
        document.querySelectorAll('.customer-toolbar input,.customer-toolbar select,.customer-toolbar button,.customer-views button,#refreshCustomersBtn,#retryCustomersBtn,#customerPageSize,#customersTableBody button').forEach(control => control.disabled = busy);
        const pages = Math.max(1, Math.ceil(filteredCustomers().length / pageSize));
        document.getElementById("prevPageBtn").disabled = busy || currentPage <= 1;
        document.getElementById("nextPageBtn").disabled = busy || currentPage >= pages;
        document.getElementById("refreshCustomersBtn").innerHTML = fa(loadingCustomers ? "spinner fa-spin" : "rotate") + (loadingCustomers ? " Updating…" : " Refresh");
    }

    function filteredCustomers() {
        const query = searchInput.value.trim().toLowerCase();
        const result = allCustomers.filter(customer => {
            const haystack = [customer.first_name, customer.last_name, customer.email, customer.phone, customer.id].join(" ").toLowerCase();
            return haystack.includes(query) && (!customerView || (customerView === "with-orders" ? Number(customer.orders) > 0 : Number(customer.orders) === 0)) && (!contactFilter.value || !String(customer[contactFilter.value] || "").trim());
        });
        return result.sort((a,b) => sortInput.value === "name" ? fullName(a).localeCompare(fullName(b)) : sortInput.value === "orders" ? Number(b.orders)-Number(a.orders) : sortInput.value === "spend" ? Number(b.total_spent)-Number(a.total_spent) : Number(b.id)-Number(a.id));
    }

    function renderCustomers() {
        const filtered = filteredCustomers();
        const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
        currentPage = Math.min(currentPage, pages);
        const start = (currentPage - 1) * pageSize;
        tableBody.innerHTML = filtered.slice(start,start+pageSize).map(customer => {
            const name = fullName(customer);
            const initials = [customer.first_name,customer.last_name].filter(Boolean).map(value=>Array.from(String(value).trim())[0] || "").join("").toUpperCase().slice(0,2) || "C";
            const date = new Date(String(customer.created_at || "").replace(" ", "T"));
            const joined = Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString("en-GB", {day:"2-digit",month:"short",year:"numeric"});
            const phone = String(customer.phone || "").trim();
            const phoneHref = phone.replace(/[^+0-9]/g, "");
            const profile = "Customer-details.html?id=" + encodeURIComponent(customer.id);
            return `<tr data-customer-id="${Number(customer.id)}"><td data-label="Customer"><div class="customer-person"><span class="customer-initials" aria-hidden="true">${escapeHTML(initials)}</span><div><a class="customer-name" href="${profile}">${escapeHTML(name)}</a><span class="customer-email">${escapeHTML(customer.email || "Email not provided")}</span><span class="customer-record-id">Customer #${Number(customer.id)}</span></div></div></td>
            <td data-label="Contact">${phone ? `<a class="customer-phone" href="tel:${escapeHTML(phoneHref)}">${fa("phone")}<span>${escapeHTML(phone)}</span></a>` : '<span class="customer-missing">'+fa("phone")+' No phone added</span>'}<span class="customer-address" title="${escapeHTML(customer.address || "")}">${escapeHTML(customer.address || "No address added")}</span></td>
            <td data-label="Orders"><span class="customer-orders-value">${Number(customer.orders || 0)}</span><small class="customer-orders-note">${Number(customer.orders) ? (Number(customer.orders) === 1 ? "order placed" : "orders placed") : "No orders yet"}</small></td>
            <td data-label="Delivered spend"><strong class="customer-spend">${money(customer.total_spent)}</strong><small class="customer-spend-note">Delivered orders</small></td>
            <td data-label="Joined"><span class="customer-joined">${escapeHTML(joined)}</span></td>
            <td data-label="Actions"><div class="customer-actions"><a class="action-btn" href="${profile}" aria-label="View ${escapeHTML(name)}">${fa("eye")}<span>View</span></a><button class="action-btn" type="button" data-action="edit" data-customer-id="${Number(customer.id)}" aria-label="Edit ${escapeHTML(name)}">${fa("pen")}<span>Edit</span></button></div></td></tr>`;
        }).join("") || '<tr><td colspan="6"><div class="customer-empty">'+fa("users")+'<h3>'+ (allCustomers.length ? "No customers match this view" : "Your customer directory starts here") +'</h3><p>'+ (allCustomers.length ? "Try a different search or reset your filters." : "Customer accounts will appear here when they register.") +'</p></div></td></tr>';
        document.getElementById("customerTotal").textContent = allCustomers.length;
        document.getElementById("customersWithOrders").textContent = allCustomers.filter(customer=>Number(customer.orders)>0).length;
        document.getElementById("customersMissingPhone").textContent = allCustomers.filter(customer=>!String(customer.phone || "").trim()).length;
        document.getElementById("customerResultCount").textContent = filtered.length+" of "+allCustomers.length+" customers";
        document.getElementById("paginationInfo").textContent = (filtered.length ? start+1 : 0)+"–"+Math.min(start+pageSize,filtered.length)+" of "+filtered.length+" · Page "+currentPage+" of "+pages;
        document.querySelectorAll('[data-customer-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.customerView===customerView)));
        setCustomerBusy();
    }

    async function loadCustomers() {
        if (loadingCustomers) return;
        loadingCustomers = true;
        setCustomerBusy();
        document.getElementById("customersError").hidden = true;
        if (!allCustomers.length) tableBody.innerHTML = '<tr><td colspan="6" class="empty-state"><span class="spinner"></span><p>Loading customer directory…</p></td></tr>';
        try {
            allCustomers = await AdminAPI.customers();
            renderCustomers();
            document.getElementById("customersUpdated").textContent = "Updated " + new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
        } catch (error) {
            document.getElementById("customersErrorText").textContent = error.message;
            document.getElementById("customersError").hidden = false;
            if (!allCustomers.length) {
                tableBody.innerHTML = '<tr><td colspan="6"><div class="customer-empty">'+fa("cloud-arrow-down")+'<h3>Customers could not load</h3><p>Retry the connection above to continue.</p></div></td></tr>';
                document.getElementById("customerResultCount").textContent = "Unavailable";
                document.getElementById("paginationInfo").textContent = "Customers unavailable";
            }
        } finally { loadingCustomers = false; setCustomerBusy(); }
    }

    function customerForm(customer) {
        return `<div class="customer-profile-editor"><p class="customer-editor-intro">Update the customer’s contact and profile details.</p><div class="customer-editor-grid"><div><label for="customer-first-name">First name</label><input id="customer-first-name" maxlength="100" autocomplete="given-name" required value="${escapeHTML(customer.first_name || "")}"></div><div><label for="customer-last-name">Last name</label><input id="customer-last-name" maxlength="100" autocomplete="family-name" required value="${escapeHTML(customer.last_name || "")}"></div><div class="customer-editor-full"><label for="customer-email">Email address</label><input id="customer-email" type="email" maxlength="255" autocomplete="email" required value="${escapeHTML(customer.email || "")}"></div><div class="customer-editor-full"><label for="customer-phone">Phone <span>Optional</span></label><input id="customer-phone" type="tel" maxlength="20" autocomplete="tel" placeholder="e.g. 0791234567" value="${escapeHTML(customer.phone || "")}"><small>Include the country code for an international number.</small></div><div class="customer-editor-full"><label for="customer-address">Address <span>Optional</span></label><textarea id="customer-address" maxlength="2000" autocomplete="street-address" rows="3" dir="auto">${escapeHTML(customer.address || "")}</textarea></div></div></div>`;
    }

    async function editCustomer(customer) {
        if (actionInProgress || loadingCustomers) return;
        actionInProgress = true;
        setCustomerBusy();
        try {
            const result = await Alerts.form("Edit customer", customerForm(customer), async () => {
                const first = document.getElementById("customer-first-name"), last = document.getElementById("customer-last-name"), email = document.getElementById("customer-email"), phone = document.getElementById("customer-phone"), address = document.getElementById("customer-address");
                if (!first.value.trim() || !last.value.trim() || !email.value.trim()) { Alerts.validation("First name, last name and email are required."); (!first.value.trim() ? first : !last.value.trim() ? last : email).focus(); return false; }
                if (!email.checkValidity()) { Alerts.validation("Enter a valid email address."); email.focus(); return false; }
                const phoneValue = phone.value.trim();
                const normalized = phoneValue.replace(/[\s().-]/g, "");
                if (phoneValue && !/^\+?[0-9٠-٩۰-۹]{8,15}$/.test(normalized)) { Alerts.validation("Enter a phone number with 8–15 digits, or leave it blank."); phone.focus(); return false; }
                try { return await AdminAPI.updateCustomer(customer.id, {first_name:first.value.trim(),last_name:last.value.trim(),email:email.value.trim(),phone:phoneValue,address:address.value.trim()}); }
                catch (error) { Alerts.validation(error.message); return false; }
            }, {width:640,customClass:{popup:"customer-editor-dialog"},showCloseButton:true,closeButtonAriaLabel:"Close customer editor",confirmButtonText:"Save changes"});
            if (result.isConfirmed) { Alerts.toast("Customer updated"); await loadCustomers(); }
        } finally {actionInProgress = false; setCustomerBusy();}
    }

    function resetFilters() {
        searchInput.value = "";
        contactFilter.value = "";
        sortInput.value = "newest";
        customerView = "";
        currentPage = 1;
        renderCustomers();
    }
    tableBody.addEventListener("click", event => {
        const button = event.target.closest('button[data-action="edit"]');
        if (!button || loadingCustomers || actionInProgress) return;
        const customer = allCustomers.find(customer=>String(customer.id)===button.dataset.customerId);
        if (customer) editCustomer(customer);
    });
    for (const input of [searchInput, contactFilter, sortInput]) input.addEventListener(input === searchInput ? "input" : "change", () => {currentPage=1; renderCustomers();});
    document.querySelectorAll('[data-customer-view]').forEach(button=>button.addEventListener('click',()=>{customerView=button.dataset.customerView; currentPage=1; renderCustomers();}));
    document.getElementById("resetCustomerFilters").addEventListener("click", resetFilters);
    document.getElementById("refreshCustomersBtn").addEventListener("click", loadCustomers);
    document.getElementById("retryCustomersBtn").addEventListener("click", loadCustomers);
    document.getElementById("customerPageSize").addEventListener("change", event=>{pageSize=Number(event.target.value); currentPage=1; renderCustomers();});
    document.getElementById("prevPageBtn").addEventListener("click",()=>{if(currentPage>1&&!loadingCustomers){currentPage--;renderCustomers();}});
    document.getElementById("nextPageBtn").addEventListener("click",()=>{if(!loadingCustomers&&currentPage<Math.ceil(filteredCustomers().length/pageSize)){currentPage++;renderCustomers();}});
    loadCustomers();
});

