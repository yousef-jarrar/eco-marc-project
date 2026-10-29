const DISCOUNTS_API =  "http://localhost/eco-marc-project-main/backend/api/discounts.php";

const DISCOUNTS_PER_PAGE = 10;

let allDiscounts = [];
let currentPage = 1;
let isLoading = false;

const body = document.getElementById("discounts-body");
const searchInput = document.getElementById("discount-search");
const typeFilter = document.getElementById("discount-type");
const addButton = document.getElementById("add-discount");
const previousButton = document.getElementById("discount-previous");
const nextButton = document.getElementById("discount-next");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(String(value).replace(" ", "T"));

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function toDateTimeInput(value) {
  return value ? String(value).replace(" ", "T").slice(0, 16) : "";
}

function toApiDate(value) {
  return value ? value.replace("T", " ") + ":00" : null;
}

function isActive(discount) {
  return discount.is_active === true ||
    discount.is_active === 1 ||
    discount.is_active === "1";
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `Request failed (${response.status})`
    );
  }

  return result;
}

function extractDiscounts(result) {
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data?.data)) return result.data.data;

  return [];
}

function getFilteredDiscounts() {
  const search = searchInput.value.trim().toLowerCase();

  const startFrom =
    document.getElementById("discount-start-filter").value;

  const endUntil =
    document.getElementById("discount-end-filter").value;

  return allDiscounts.filter(discount => {
    const searchable = [
      discount.name,
      discount.coupon_code,
      discount.type
    ].join(" ").toLowerCase();

    // Search by name or coupon code.
    if (!searchable.includes(search)) {
      return false;
    }

    // Filter by discount start date.
    if (startFrom) {
      if (!discount.start_date) return false;

      const discountStart = String(discount.start_date).slice(0, 10);

      if (discountStart < startFrom) {
        return false;
      }
    }

    // Filter by discount end date.
    if (endUntil) {
      if (!discount.end_date) return false;

      const discountEnd = String(discount.end_date).slice(0, 10);

      if (discountEnd > endUntil) {
        return false;
      }
    }

    return true;
  });
}

function statusBadge(discount) {
  const active = isActive(discount);
  const status = active ? "Active" : "Inactive";
  const className = active ? "approved" : "hidden";

  return `<span class="status ${className}">${status}</span>`;
}

function renderDiscountRow(discount) {
  const row = document.createElement("tr");
  row.dataset.discountId = discount.id;

  row.innerHTML = `
    <td>
      <strong>${escapeHTML(discount.name)}</strong>
      <div class="tiny muted">#${escapeHTML(discount.id)}</div>
    </td>
    <td>${escapeHTML(discount.type)}</td>
    <td><strong>${escapeHTML(discount.percentage)}%</strong></td>
    <td>${escapeHTML(discount.coupon_code || "—")}</td>
    <td>${escapeHTML(formatDate(discount.start_date))}</td>
    <td>${escapeHTML(formatDate(discount.end_date))}</td>
    <td>${statusBadge(discount)}</td>
    <td>
      <div class="d-flex gap-2 flex-wrap">
        <button class="secondary" data-action="edit">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
          Edit
        </button>

        ${
          isActive(discount)
            ? `<button class="secondary" data-action="deactivate">
                 <i class="fa-solid fa-ban" aria-hidden="true"></i>
                 Deactivate
               </button>`
            : ""
        }
      </div>
    </td>
  `;

  return row;
}

function renderDiscounts() {
  const filtered = getFilteredDiscounts();
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / DISCOUNTS_PER_PAGE)
  );

  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * DISCOUNTS_PER_PAGE;
  const pageItems = filtered.slice(start, start + DISCOUNTS_PER_PAGE);

  body.replaceChildren();

  setText(
    "discount-count",
    `${filtered.length} of ${allDiscounts.length} discounts`
  );

  setText(
    "discount-pagination-label",
    `Page ${currentPage} of ${totalPages}`
  );

  previousButton.disabled = isLoading || currentPage <= 1;
  nextButton.disabled = isLoading || currentPage >= totalPages;

  if (pageItems.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <i class="fa-solid fa-tags" aria-hidden="true"></i>
            <h3>No discounts found</h3>
            <p class="muted">Try another search or add a discount.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  pageItems.forEach(discount => {
    body.appendChild(renderDiscountRow(discount));
  });
}

function updateStatistics() {
  const active = allDiscounts.filter(isActive);

  setText("total-discounts", active.length);
  setText(
    "normal-discounts",
    active.filter(item => item.type === "normal").length
  );
  setText(
    "coupon-discounts",
    active.filter(item => item.type === "coupon").length
  );
}

function setLoading(loading) {
  isLoading = loading;

  addButton.disabled = loading;
  previousButton.disabled = loading;
  nextButton.disabled = loading;

  body.querySelectorAll("button").forEach(button => {
    button.disabled = loading;
  });
}

async function loadDiscounts() {
  if (isLoading) return;

  setLoading(true);
  document.getElementById("discounts-error").hidden = true;

  body.innerHTML = `
    <tr>
      <td colspan="8">
        <div class="loading">
          <span class="spinner"></span>
          <p>Loading discounts...</p>
        </div>
      </td>
    </tr>
  `;

  try {
    const result = await apiRequest(`${DISCOUNTS_API}?page=1`);

    allDiscounts = extractDiscounts(result);

    updateStatistics();
    currentPage = 1;

    setText(
      "discounts-updated",
      "Updated " + new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    );

    setLoading(false);
    renderDiscounts();
  } catch (error) {
    allDiscounts = [];
    updateStatistics();

    setLoading(false);

    document.getElementById("discounts-error").hidden = false;
    setText("discounts-error-text", error.message);
    setText("discount-count", "Unavailable");

    body.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <h3>Could not load discounts</h3>
            <p class="muted">Check the API connection and retry.</p>
          </div>
        </td>
      </tr>
    `;
  }
}

function discountFormHTML(discount = null) {
  const editing = Boolean(discount);

  return `
    <div style="text-align:left">
      <label for="discount-name">Discount name</label>
      <input id="discount-name" class="swal2-input"
             maxlength="100" placeholder="Summer Sale"
             value="${escapeHTML(discount?.name || "")}"
             ${editing ? "disabled" : "required"}>

      ${
        editing
          ? `<p class="muted">Name and type cannot be changed here.</p>`
          : `
            <label for="discount-type-input">Discount type</label>
            <select id="discount-type-input" class="swal2-select">
              <option value="normal">Normal discount</option>
              <option value="coupon">Coupon discount</option>
            </select>
            <p class="muted">Coupon codes are generated automatically.</p>
          `
      }

      <label for="discount-percentage">Percentage (0–100)</label>
      <input id="discount-percentage" class="swal2-input"
             type="number" min="0" max="100" step="0.01"
             value="${editing ? escapeHTML(discount.percentage) : ""}"
             required>

      <label for="discount-start">Start date (optional)</label>
      <input id="discount-start" class="swal2-input"
             type="datetime-local"
             value="${editing ? toDateTimeInput(discount.start_date) : ""}">

      <label for="discount-end">End date (optional)</label>
      <input id="discount-end" class="swal2-input"
             type="datetime-local"
             value="${editing ? toDateTimeInput(discount.end_date) : ""}">
    </div>
  `;
}

function validateDates(start, end) {
  if (start && end && new Date(start) > new Date(end)) {
    return "The start date must be before the end date.";
  }

  return null;
}

async function openDiscountForm(discount = null) {
  if (isLoading) return;

  const editing = Boolean(discount);

  const result = await Swal.fire({
    title: editing ? "Edit discount" : "Add discount",
    html: discountFormHTML(discount),
    confirmButtonText: editing ? "Save changes" : "Create discount",
    showCancelButton: true,
    cancelButtonText: "Cancel",
    focusConfirm: false,

    preConfirm: () => {
      const name = document.getElementById("discount-name").value.trim();
      const rawPercentage =
        document.getElementById("discount-percentage").value;
      const amount = Number(rawPercentage);

      const start = document.getElementById("discount-start").value;
      const end = document.getElementById("discount-end").value;

      if (!editing && !name) {
        Swal.showValidationMessage("Enter a discount name.");
        return false;
      }

      if (
        rawPercentage === "" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 100
      ) {
        Swal.showValidationMessage(
          "Percentage must be between 0 and 100."
        );
        return false;
      }

      const dateError = validateDates(start, end);

      if (dateError) {
        Swal.showValidationMessage(dateError);
        return false;
      }

      const payload = {
        percentage: amount,
        start_date: toApiDate(start),
        end_date: toApiDate(end)
      };

      if (!editing) {
        payload.name = name;
        payload.type =
          document.getElementById("discount-type-input").value;
      }

      return payload;
    }
  });

  if (!result.isConfirmed) return;

  setLoading(true);

  try {
    if (editing) {
      await apiRequest(
        `${DISCOUNTS_API}?id=${encodeURIComponent(discount.id)}`,
        {
          method: "PUT",
          body: JSON.stringify(result.value)
        }
      );
    } else {
      await apiRequest(DISCOUNTS_API, {
        method: "POST",
        body: JSON.stringify(result.value)
      });
    }

    setLoading(false);

    await Swal.fire({
      icon: "success",
      title: editing ? "Discount updated" : "Discount created",
      text: "The discount was saved successfully."
    });

    await loadDiscounts();
  } catch (error) {
    setLoading(false);

    await Swal.fire({
      icon: "error",
      title: "Could not save discount",
      text: error.message
    });
  }
}

async function deactivateDiscount(discount) {
  if (isLoading) return;

  const confirmation = await Swal.fire({
    icon: "warning",
    title: "Deactivate this discount?",
    text: `"${discount.name}" will no longer be active.`,
    showCancelButton: true,
    confirmButtonText: "Deactivate",
    cancelButtonText: "Cancel"
  });

  if (!confirmation.isConfirmed) return;

  setLoading(true);

  try {
    await apiRequest(
      `${DISCOUNTS_API}?id=${encodeURIComponent(discount.id)}`,
      { method: "DELETE" }
    );

    setLoading(false);

    await Swal.fire({
      icon: "success",
      title: "Discount deactivated",
      text: "The discount is now inactive."
    });

    await loadDiscounts();
  } catch (error) {
    setLoading(false);

    await Swal.fire({
      icon: "error",
      title: "Could not deactivate discount",
      text: error.message
    });
  }
}

body.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button || isLoading) return;

  const row = button.closest("[data-discount-id]");

  const discount = allDiscounts.find(
    item => String(item.id) === row.dataset.discountId
  );

  if (!discount) return;

  if (button.dataset.action === "edit") {
    openDiscountForm(discount);
  }

  if (button.dataset.action === "deactivate") {
    deactivateDiscount(discount);
  }
});

searchInput.addEventListener("input", () => {
  currentPage = 1;
  renderDiscounts();
});

document.getElementById("discount-start-filter")
  .addEventListener("change", () => {
    currentPage = 1;
    renderDiscounts();
  });

document.getElementById("discount-end-filter")
  .addEventListener("change", () => {
    currentPage = 1;
    renderDiscounts();
  });

document.getElementById("clear-discount-filters")
  .addEventListener("click", () => {
    searchInput.value = "";
    document.getElementById("discount-start-filter").value = "";
    document.getElementById("discount-end-filter").value = "";

    currentPage = 1;
    renderDiscounts();
  });

previousButton.addEventListener("click", () => {
  if (!isLoading && currentPage > 1) {
    currentPage--;
    renderDiscounts();
  }
});

nextButton.addEventListener("click", () => {
  const totalPages = Math.max(
    1,
    Math.ceil(getFilteredDiscounts().length / DISCOUNTS_PER_PAGE)
  );

  if (!isLoading && currentPage < totalPages) {
    currentPage++;
    renderDiscounts();
  }
});

addButton.addEventListener("click", () => openDiscountForm());

document.getElementById("retry-discounts")
  .addEventListener("click", loadDiscounts);

loadDiscounts();