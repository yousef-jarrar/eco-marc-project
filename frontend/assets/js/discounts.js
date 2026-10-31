const DISCOUNTS_API =  AdminConfig.apiBase + "discounts.php";

const DISCOUNTS_PER_PAGE = 10;

let allDiscounts = [];
let currentPage = 1;
let isLoading = false;
let discountServerTime = null;
let discountClockStarted = 0;

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
  await EcoAuth.ready;
  const response = await EcoAuth.fetch(url, {
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

    if (typeFilter.value && discount.type !== typeFilter.value) return false;
    const state = discount.promotion_status || (isActive(discount) ? 'active' : 'inactive');
    const statusFilter = document.getElementById('discount-state').value;
    if (statusFilter && state !== statusFilter) return false;
    if (!searchable.includes(search)) {
      return false;
    }

    if (startFrom) {
      if (!discount.start_date) return false;

      const discountStart = String(discount.start_date).slice(0, 10);

      if (discountStart < startFrom) {
        return false;
      }
    }

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
  const state = discount.promotion_status || (active ? "active" : "inactive");
  const status = state === "active" ? "Live" : state.charAt(0).toUpperCase() + state.slice(1);
  const className = state === "active" ? "approved" : state === "scheduled" ? "pending" : "hidden";

  return `<span class="status ${className}">${escapeHTML(status)}</span>`;
}

function renderDiscountRow(discount) {
  const row = document.createElement("tr");
  row.dataset.discountId = discount.id;
  const coupon = discount.type === "coupon";
  row.innerHTML = `
    <td><div class="discount-name"><span class="discount-row-icon">${fa(coupon ? "ticket" : "tags")}</span><div><strong>${escapeHTML(discount.name)}</strong><small>${coupon ? "Coupon code" : "Product discount"} · #${escapeHTML(discount.id)}</small></div></div>
    ${coupon ? `<button type="button" class="coupon-copy" data-action="copy" title="Copy coupon code"><code>${escapeHTML(discount.coupon_code || "—")}</code>${fa("copy")}</button>` : ""}</td>
    <td><span class="discount-rate">${escapeHTML(discount.percentage)}<small>% off</small></span></td>
    <td><span class="discount-scope">${coupon ? "At checkout" : Number(discount.product_count || 0) + (Number(discount.product_count) === 1 ? " product" : " products")}</span>${!coupon && !Number(discount.product_count) ? '<small class="discount-unassigned">No products assigned</small>' : ""}</td>
    <td class="discount-schedule"><span><small>From</small>${escapeHTML(discount.start_date ? formatDate(discount.start_date) : "Immediately")}</span><span><small>Until</small>${escapeHTML(discount.end_date ? formatDate(discount.end_date) : "No end date")}</span></td>
    <td>${statusBadge(discount)}</td>
    <td><div class="discount-row-actions"><button class="secondary" data-action="edit" ${isActive(discount) ? "" : "disabled"} aria-label="Edit ${escapeHTML(discount.name)}">${fa("pen")} Edit</button>${isActive(discount) ? `<button class="secondary" data-action="deactivate" aria-label="Deactivate ${escapeHTML(discount.name)}">${fa("ban")} Deactivate</button>` : '<span class="tiny muted">Inactive offer</span>'}</div></td>`;
  const labels = ["Promotion", "Offer", "Applies to", "Schedule", "Status", "Actions"];
  row.querySelectorAll("td").forEach((cell, index) => cell.dataset.label = labels[index]);
  return row;
}

function renderDiscounts() {
  const filtered = getFilteredDiscounts();
  const sort = document.getElementById("discount-sort").value;
  filtered.sort((a, b) => sort === "percentage" ? Number(b.percentage) - Number(a.percentage) : sort === "ending" ? String(a.end_date || "9999").localeCompare(String(b.end_date || "9999")) : Number(b.id) - Number(a.id));
  updateDiscountViews();
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
    `${filtered.length ? start + 1 : 0}–${Math.min(start + DISCOUNTS_PER_PAGE, filtered.length)} of ${filtered.length} · Page ${currentPage} of ${totalPages}`
  );

  previousButton.disabled = isLoading || currentPage <= 1;
  nextButton.disabled = isLoading || currentPage >= totalPages;

  if (pageItems.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
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
  const active = allDiscounts.filter(d => (d.promotion_status || (isActive(d) ? "active" : "inactive")) === "active");

  setText("total-discounts", active.length);
  setText(
    "normal-discounts",
    allDiscounts.filter(item => item.type === "normal").length
  );
  setText(
    "coupon-discounts",
    allDiscounts.filter(item => item.type === "coupon").length
  );
}

function setLoading(loading) {
  isLoading = loading;

  addButton.disabled = loading;
  document.getElementById("add-coupon").disabled = loading;
  document.getElementById("refresh-discounts").disabled = loading;
  document.querySelector(".discounts-panel").setAttribute("aria-busy", String(loading));
  document.querySelectorAll(".discounts-toolbar input,.discounts-toolbar select,.discounts-toolbar button,.discount-date-filters input,[data-discount-view]").forEach(control => control.disabled = loading);
  previousButton.disabled = loading;
  nextButton.disabled = loading;

  body.querySelectorAll("button").forEach(button => {
    const discount = allDiscounts.find(item => String(item.id) === button.closest("[data-discount-id]")?.dataset.discountId);
    button.disabled = loading || (button.dataset.action === "edit" && !isActive(discount || {}));
  });
}

async function loadDiscounts() {
  if (isLoading) return;

  setLoading(true);
  document.getElementById("discounts-error").hidden = true;

  body.innerHTML = `
    <tr>
      <td colspan="6">
        <div class="loading">
          <span class="spinner"></span>
          <p>Loading discounts...</p>
        </div>
      </td>
    </tr>
  `;

  try {
    const result = await apiRequest(`${DISCOUNTS_API}?page=1&include_inactive=1`);

    discountServerTime = result.server_time || null;
    discountClockStarted = Date.now();
    allDiscounts = extractDiscounts(result);
    const pages = Number(result.pagination?.total_pages) || 1;
    for (let page = 2; page <= pages; page++) {
      const next = await apiRequest(`${DISCOUNTS_API}?page=${page}&include_inactive=1`);
      allDiscounts.push(...extractDiscounts(next));
    }

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
    setText("discount-pagination-label", "Promotions unavailable");
    ["total-discounts", "normal-discounts", "coupon-discounts"].forEach(id => setText(id, "—"));
    updateDiscountViews();

    body.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <h3>Could not load discounts</h3>
            <p class="muted">Check the API connection and retry.</p>
          </div>
        </td>
      </tr>
    `;
  }
}

function discountFormHTML(discount = null, initialType = "normal") {
  const editing = Boolean(discount);
  return `<div class="discount-editor-form">
    <p class="discount-editor-intro">${editing ? 'Update the offer and where it applies.' : 'Set your offer, choose where it applies, and review it before saving.'}</p>
    <div class="discount-editor-fields">
      <div class="discount-editor-field"><label for="discount-name">Offer name</label><input id="discount-name" maxlength="100" placeholder="e.g. Weekend collection" value="${escapeHTML(discount?.name || '')}" ${editing ? 'disabled' : 'required'}></div>
      <div class="discount-editor-field"><label for="discount-type-input">Offer type</label><select id="discount-type-input" ${editing ? 'disabled' : ''}><option value="normal" ${(discount?.type || initialType) !== 'coupon' ? 'selected' : ''}>Product discount</option><option value="coupon" ${(discount?.type || initialType) === 'coupon' ? 'selected' : ''}>Coupon code</option></select></div>
      <div class="discount-editor-field"><label for="discount-percentage">Discount percentage</label><div class="discount-percent-input"><input id="discount-percentage" type="number" min="0" max="100" step="0.01" placeholder="e.g. 20" value="${editing ? escapeHTML(discount.percentage) : ''}" required><span aria-hidden="true">%</span></div><small>The percentage deducted from the price.</small></div>
      <div id="discount-code-field" class="discount-editor-field" hidden><label for="discount-code">Your coupon code</label><input id="discount-code" type="text" name="coupon_code" minlength="3" maxlength="40" spellcheck="false" autocomplete="off" placeholder="e.g. WEEKEND20" value="${escapeHTML(discount?.coupon_code || '')}" aria-describedby="discount-code-help"><small id="discount-code-help">3–40 letters or numbers. Hyphens and underscores are allowed.${editing ? ' Changing this replaces the old code.' : ''}</small></div>
    </div>
    <div class="discount-editor-schedule"><div class="discount-section-title"><h3><i class="fa-regular fa-calendar" aria-hidden="true"></i> Schedule <span>Optional</span></h3><button type="button" id="discount-clear-dates">Clear dates</button></div><div class="discount-editor-fields"><div class="discount-editor-field"><label for="discount-start">Starts</label><input id="discount-start" type="datetime-local" value="${editing ? toDateTimeInput(discount.start_date) : ''}"></div><div class="discount-editor-field"><label for="discount-end">Ends</label><input id="discount-end" type="datetime-local" value="${editing ? toDateTimeInput(discount.end_date) : ''}"></div></div><p class="discount-editor-hint">Choose the current time or a future time. Leave dates empty to start immediately with no end date.</p></div>
    ${productPickerHTML(discount)}
    <div class="discount-offer-preview" aria-live="polite"><span class="discount-preview-icon"><i class="fa-solid fa-tag" aria-hidden="true"></i></span><div><strong id="discount-preview-title">Your offer preview</strong><p id="discount-preview-detail">Enter a percentage to preview your offer.</p></div></div>
  </div>`;
}

function discountNow() {
  const value = discountServerTime ? new Date(discountServerTime.replace(' ', 'T')).getTime() + Date.now() - discountClockStarted : Date.now();
  const now = new Date(value);
  now.setSeconds(0, 0);
  return now;
}
function localDateInput(date) {
  const pad = number => String(number).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
function validateDates(start, end, original = null) {
  const now = discountNow();
  if (start && start !== toDateTimeInput(original?.start_date) && new Date(start) < now) return 'Start date cannot be in the past. Choose the current time or a future time.';
  if (end && end !== toDateTimeInput(original?.end_date) && new Date(end) <= now) return 'End date must be in the future.';
  if (start && end && new Date(start) >= new Date(end)) return 'The start date must be before the end date.';
  return null;
}

let discountProducts = [];

function productPickerHTML(discount) {
  const selected = new Set((discount?.product_ids || discountProducts.filter(p => Number(p.discount_id) === Number(discount?.id)).map(p => p.id)).map(Number));
  const categories = [...new Set(discountProducts.map(product => product.category_name).filter(Boolean))].sort();
  return `<fieldset id="discount-products-field" class="discount-products-field">
    <legend>Apply to products</legend>
    <p class="picker-intro">Choose which products receive this offer. Prices below update as you change the percentage.</p>
    <div class="picker-filters"><div class="picker-search"><label class="sr-only" for="discount-product-search">Find a product</label>${fa("magnifying-glass")}<input id="discount-product-search" type="search" placeholder="Search name or product ID…" autocomplete="off"></div><div><label class="sr-only" for="discount-product-category">Category</label><select id="discount-product-category"><option value="">All categories</option>${categories.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join("")}</select></div></div>
    <div class="picker-view-tools"><div class="picker-views" role="group" aria-label="Products to show"><button type="button" data-picker-view="all" aria-pressed="true">All products</button><button type="button" data-picker-view="selected" aria-pressed="false">Selected <span id="picker-selected-badge">0</span></button></div><button type="button" class="secondary" id="picker-reset-filters">Reset filters</button></div>
    <div id="picker-selected-chips" class="picker-selected-chips" aria-label="Selected products" hidden></div>
    <div class="discount-selection-tools"><p id="discount-selected-count" class="tiny muted" aria-live="polite"></p><button type="button" class="secondary" id="select-visible-products">Select visible</button><button type="button" class="secondary" id="clear-selected-products">Clear selection</button></div>
    <div class="discount-product-list" role="group" aria-label="Products available for this discount">${discountProducts.map(product => {
      const replacement = Boolean(product.discount_name && Number(product.discount_id) !== Number(discount?.id));
      let image = "";
      if (product.image_url) {
        try { const url = new URL(product.image_url, document.baseURI); if (["http:", "https:"].includes(url.protocol)) image = url.href; } catch (error) {}
      }
      return `<label class="discount-product-option" data-product-name="${escapeHTML((product.name + " " + product.id).toLowerCase())}" data-category="${escapeHTML(product.category_name || "")}" data-replaces="${replacement ? "1" : "0"}">
      <input type="checkbox" name="discount-products" value="${Number(product.id)}" ${selected.has(Number(product.id)) ? "checked" : ""}>
      <span class="picker-thumb">${fa("image")}${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">` : ""}</span>
      <span class="picker-product-info"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.category_name || "Product")} · #${Number(product.id)}</small>${replacement ? `<span class="picker-offer-badge">${fa("arrows-rotate")} Replaces ${escapeHTML(product.discount_name)}</span>` : discount && Number(product.discount_id) === Number(discount.id) ? '<span class="picker-offer-badge current">In this offer</span>' : ""}</span>
      <span class="picker-price"><span class="picker-base-price">${Number(product.price).toFixed(2)} JOD</span><span data-price-preview="${Number(product.price)}"></span></span>
    </label>`;}).join("")}</div>
    <div id="discount-no-matches" class="picker-empty" hidden>${fa("magnifying-glass")}<strong>No matching products</strong><p>Try another search or reset the filters. Your selections are kept.</p></div>
    <p id="picker-results" class="picker-results" aria-live="polite"></p>
    <div id="picker-replacement-note" class="picker-replacement-note" role="status" hidden></div>
    <p class="picker-footnote">No products selected? You can save this offer and assign products later.</p>
  </fieldset>`;
}

async function openDiscountForm(discount = null, initialType = "normal") {
  if (isLoading) return;
  setLoading(true);
  try {
    const result = await apiRequest(AdminConfig.apiBase + 'Products.php?admin=1');
    discountProducts = Array.isArray(result) ? result : result.data;
    if (!Array.isArray(discountProducts)) throw new Error('Products could not be loaded. Please retry.');
  } catch (error) {
    setLoading(false);
    Alerts.show('Products unavailable', error.message, 'error');
    return;
  }
  setLoading(false);
  const editing = Boolean(discount);
  const dialog = Alerts.form(editing ? 'Edit discount' : 'Create discount', discountFormHTML(discount, initialType), async () => {
    const name = document.getElementById('discount-name').value.trim();
    const input = document.getElementById('discount-percentage').value;
    const percentage = Number(input);
    const start = document.getElementById('discount-start').value;
    const end = document.getElementById('discount-end').value;
    const type = discount?.type || document.getElementById('discount-type-input').value;
    if (!name) { Alerts.validation('Enter a discount name.'); return false; }
    if (input === '' || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) { Alerts.validation('Percentage must be between 0 and 100.'); return false; }
    const error = validateDates(start, end, discount);
    if (error) { Alerts.validation(error); document.getElementById(error.startsWith('Start') ? 'discount-start' : 'discount-end').focus(); return false; }
    const payload = {percentage, start_date:editing && start === toDateTimeInput(discount.start_date) ? discount.start_date : toApiDate(start), end_date:editing && end === toDateTimeInput(discount.end_date) ? discount.end_date : toApiDate(end)};
    payload.product_ids = type === 'normal' ? [...document.querySelectorAll('input[name="discount-products"]:checked')].map(el => Number(el.value)) : [];
    if (type === 'coupon') {
      const code = document.getElementById('discount-code').value.trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) { Alerts.validation('Enter a coupon code of 3–40 letters or numbers, with optional hyphens or underscores.'); document.getElementById('discount-code').focus(); return false; }
      payload.coupon_code = code;
    }
    if (!editing) Object.assign(payload, {name, type});
    try {
      return await apiRequest(DISCOUNTS_API + (editing ? '?id=' + encodeURIComponent(discount.id) : ''), {method:editing ? 'PUT' : 'POST', body:JSON.stringify(payload)});
    } catch (requestError) { Alerts.validation(requestError.message); return false; }
  }, {width:760,customClass:{popup:'discount-editor',htmlContainer:'discount-editor-content'},showCloseButton:true,closeButtonAriaLabel:'Close discount editor',confirmButtonText:editing?'Save changes':'Create discount'});
  function updateDateLimits() {
    const start = document.getElementById('discount-start'), end = document.getElementById('discount-end');
    const now = discountNow();
    const oldStart = toDateTimeInput(discount?.start_date), oldEnd = toDateTimeInput(discount?.end_date);
    start.min = start.value && start.value === oldStart && new Date(start.value) < now ? oldStart : localDateInput(now);
    const earliestEnd = new Date(Math.max(now.getTime(), start.value ? new Date(start.value).getTime() : now.getTime()) + 60000);
    end.min = end.value && end.value === oldEnd && new Date(end.value) <= now ? oldEnd : localDateInput(earliestEnd);
  }
  document.getElementById('discount-start').addEventListener('change', updateDateLimits);
  document.getElementById('discount-end').addEventListener('change', updateDateLimits);
  function updatePicker() {
    updateDateLimits();
    const type = discount?.type || document.getElementById('discount-type-input').value;
    const offerLabel = type === "coupon" ? "coupon" : "discount";
    Swal.getTitle().textContent = (editing ? "Edit " : "Create ") + offerLabel;
    Swal.getConfirmButton().textContent = editing ? "Save changes" : "Create " + offerLabel;
    document.getElementById('discount-products-field').hidden = type !== 'normal';
    document.getElementById('discount-code-field').hidden = type !== 'coupon';
    const count = document.querySelectorAll('input[name="discount-products"]:checked').length;
    document.getElementById('discount-selected-count').textContent = count + ' selected';
    const percentage = Number(document.getElementById('discount-percentage').value);
    const code = document.getElementById('discount-code').value.trim().toUpperCase();
    const valid = document.getElementById('discount-percentage').value !== '' && Number.isFinite(percentage) && percentage >= 0 && percentage <= 100;
    document.getElementById('discount-preview-title').textContent = valid ? percentage + '% off' + (type === 'coupon' && code ? ' with ' + code : '') : 'Your offer preview';
    document.getElementById('discount-preview-detail').textContent = type === 'coupon' ? 'Customers enter your code at checkout. It applies after any product discounts.' : count ? count + ' selected product' + (count === 1 ? '' : 's') + '. Prices update during the offer period.' : 'Select products below their names to apply this offer, or save it for later.';
    document.querySelectorAll('[data-price-preview]').forEach(el => {
      el.textContent = valid ? (Number(el.dataset.pricePreview) * (1 - percentage / 100)).toFixed(2) + ' JOD' : '';
      el.closest('.picker-price').classList.toggle('has-preview', valid);
    });
    updateProductSelection();
  }
  document.getElementById('discount-code').addEventListener('input', updatePicker);
  document.getElementById('discount-code').addEventListener('blur', event => {event.target.value=event.target.value.trim().toUpperCase();updatePicker();});
  document.getElementById('discount-clear-dates').addEventListener('click', () => {document.getElementById('discount-start').value='';document.getElementById('discount-end').value='';updatePicker();});
  document.getElementById('discount-type-input')?.addEventListener('change', updatePicker);
  document.getElementById('discount-percentage').addEventListener('input', updatePicker);
  document.querySelectorAll('input[name="discount-products"]').forEach(el => el.addEventListener('change', updatePicker));
  let pickerView = "all";
  function filterProductOptions() {
    const query = document.getElementById("discount-product-search").value.trim().toLowerCase();
    const category = document.getElementById("discount-product-category").value;
    const options = [...document.querySelectorAll(".discount-product-option")];
    let visible = 0;
    options.forEach(option => {
      const checked = option.querySelector("input").checked;
      option.hidden = !option.dataset.productName.includes(query) || (category && option.dataset.category !== category) || (pickerView === "selected" && !checked);
      if (!option.hidden) visible++;
    });
    document.getElementById("discount-no-matches").hidden = visible > 0;
    document.getElementById("picker-results").textContent = visible + " of " + options.length + " products shown";
    const selectable = options.filter(option => !option.hidden && !option.querySelector("input").checked).length;
    document.getElementById("select-visible-products").disabled = selectable === 0;
    document.getElementById("select-visible-products").textContent = selectable ? "Select visible (" + selectable + ")" : "All visible selected";
    document.querySelectorAll("[data-picker-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.pickerView === pickerView)));
  }
  function updateProductSelection() {
    const checked = [...document.querySelectorAll('input[name="discount-products"]:checked')];
    document.getElementById("picker-selected-badge").textContent = checked.length;
    document.getElementById("clear-selected-products").disabled = checked.length === 0;
    const chips = document.getElementById("picker-selected-chips");
    chips.replaceChildren();
    chips.hidden = checked.length === 0;
    checked.slice(0, 6).forEach(input => {
      const product = discountProducts.find(item => Number(item.id) === Number(input.value));
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "picker-chip";
      chip.setAttribute("aria-label", "Remove " + product.name + " from selection");
      const name = document.createElement("span");
      name.textContent = product.name;
      chip.appendChild(name);
      chip.insertAdjacentHTML("beforeend", fa("xmark"));
      chip.addEventListener("click", () => {input.checked = false; updatePicker(); document.querySelector('[data-picker-view="selected"]').focus();});
      chips.appendChild(chip);
    });
    if (checked.length > 6) {
      const more = document.createElement("span");
      more.className = "picker-more";
      more.textContent = "+" + (checked.length - 6) + " more";
      chips.appendChild(more);
    }
    const replacements = checked.filter(input => input.closest(".discount-product-option").dataset.replaces === "1").length;
    const note = document.getElementById("picker-replacement-note");
    note.hidden = replacements === 0;
    note.textContent = replacements + " selected product" + (replacements === 1 ? " already has" : "s already have") + " another offer. Saving will replace the existing offer on these products.";
    filterProductOptions();
  }
  document.getElementById("discount-product-search").addEventListener("input", filterProductOptions);
  document.getElementById("discount-product-category").addEventListener("change", filterProductOptions);
  document.querySelectorAll("[data-picker-view]").forEach(button => button.addEventListener("click", () => {pickerView = button.dataset.pickerView; filterProductOptions();}));
  document.getElementById("picker-reset-filters").addEventListener("click", () => {
    document.getElementById("discount-product-search").value = "";
    document.getElementById("discount-product-category").value = "";
    pickerView = "all";
    filterProductOptions();
  });
  document.querySelectorAll(".picker-thumb img").forEach(img => img.addEventListener("error", () => img.hidden = true));
  document.getElementById("select-visible-products").addEventListener("click", () => {
    document.querySelectorAll(".discount-product-option:not([hidden]) input").forEach(input => input.checked = true);
    updatePicker();
  });
  document.getElementById("clear-selected-products").addEventListener("click", () => {
    document.querySelectorAll('input[name="discount-products"]').forEach(input => input.checked = false);
    updatePicker();
  });
  updatePicker();
  const result = await dialog;
  if (result.isConfirmed) {
    Alerts.toast(editing ? 'Discount updated' : 'Discount created');
    await loadDiscounts();
  }
}

async function deactivateDiscount(discount) {
  if (isLoading) return;

  const confirmation = await Alerts.confirm("Deactivate this discount?", '"' + discount.name + '" will stop applying to new purchases.');

  if (!confirmation.isConfirmed) return;

  setLoading(true);

  try {
    await apiRequest(
      `${DISCOUNTS_API}?id=${encodeURIComponent(discount.id)}`,
      { method: "DELETE" }
    );

    setLoading(false);

    Alerts.toast("Discount deactivated");

    await loadDiscounts();
  } catch (error) {
    setLoading(false);

    Alerts.show("Could not deactivate discount", error.message, "error");
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
  if (button.dataset.action === "copy") {
    copyDiscountCode(discount.coupon_code || "");
    return;
  }

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
    typeFilter.value = "";
    document.getElementById("discount-sort").value = "newest";
    document.getElementById("discount-state").value = "";
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
[typeFilter, document.getElementById("discount-state")].forEach(el => el.addEventListener("change", () => {currentPage=1; renderDiscounts();}));

function updateDiscountViews() {
  document.querySelectorAll("[data-discount-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.discountView === typeFilter.value)));
  document.querySelectorAll("[data-discount-count]").forEach(counter => {
    const type = counter.dataset.discountCount;
    counter.textContent = type ? allDiscounts.filter(item => item.type === type).length : allDiscounts.length;
  });
}
document.querySelectorAll("[data-discount-view]").forEach(button => button.addEventListener("click", () => {
  typeFilter.value = button.dataset.discountView;
  currentPage = 1;
  renderDiscounts();
}));
document.getElementById("discount-sort").addEventListener("change", () => {currentPage = 1; renderDiscounts();});
document.getElementById("refresh-discounts").addEventListener("click", loadDiscounts);
document.getElementById("add-coupon").addEventListener("click", () => openDiscountForm(null, "coupon"));

async function copyDiscountCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    Alerts.toast("Coupon code copied");
  } catch (error) {
    Alerts.show("Copy coupon code", code, "info");
  }
}
