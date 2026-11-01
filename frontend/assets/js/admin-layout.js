document.body.classList.add('admin-notifications');
const adminNoticeStyles = document.createElement('link');
adminNoticeStyles.rel = 'stylesheet';
adminNoticeStyles.href = new URL('../css/admin-notifications.css?v=20261031-notices', document.currentScript.src).href;
document.head.append(adminNoticeStyles);
 
function escapeHTML(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML.replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function number(value) {
  const result = Number(value);
  if (Number.isFinite(result)) {
    return result;
  }
  return 0;
}

function formatJOD(value) {
  return number(value).toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " JOD";
}

function fa(name) {
  return '<i class="fa-solid fa-' + name + '" aria-hidden="true"></i>';
}

function displayDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

 
 
const adminPages = [
  { name: "Overview", page: "overview", file: "overveiw.html", icon: "chart-pie", available: true },
  { name: "Categories", page: "categories", file: "categories.html", icon: "layer-group", available: true },
  { name: "Products", page: "products", file: "Products.html", icon: "box", available: true },
  { name: "Orders", page: "orders", file: "orders.html", icon: "bag-shopping", available: true },
  { name: "Discounts", page: "discounts", file: "discounts.html", icon: "tags", available: true },
  { name: "Customers", page: "customers", file: "Customer.html", icon: "users", available: true },
  { name: "Reviews", page: "reviews", file: "reviews.html", icon: "star", available: true },
  { name: "AI business assistant", page: "ai", file: "ai-assistant.html", icon: "wand-magic-sparkles", available: true },
  { name: "Settings", page: "settings", file: "settings.html", icon: "gear", available: true }
];

function createMenuItem(item) {
  let element;
  if (item.available) {
    element = document.createElement("a");
    element.href = item.file;
  } else {
    element = document.createElement("span");
    element.setAttribute("aria-disabled", "true");
  }
  element.className = "nav-item";
  element.title = item.name;
  if (!item.available) {
    element.classList.add("is-disabled");
    element.title = item.name + " — page not available yet";
  }
  element.setAttribute("aria-label", element.title);
  element.innerHTML = fa(item.icon) + '<span class="nav-label">' + escapeHTML(item.name) + '</span>';

  if (item.available && document.body.dataset.page === item.page) {
    element.classList.add("active");
    element.setAttribute("aria-current", "page");
  }
  return element;
}

function loadAdminMenu() {
  const content = document.getElementById("sidebar-content");
  content.innerHTML = `
    <a class="wordmark" href="ai-assistant.html" aria-label="LUMIÈRE administration">
      <strong class="wordmark-full"> <span><img src="../../assets/lumiere-icon-dark.svg?v=20261101-navygold" alt="LUMIÈRE" width="35"></span>LUMIÈRE</strong>
      <strong class="wordmark-small"><img src="../../assets/lumiere-icon-dark.svg?v=20261101-navygold" alt="LUMIÈRE" width="35" height="35"></strong>
    </a>
    <p class="nav-caption">Store management</p>
    <nav id="admin-navigation" aria-label="Admin navigation"></nav>
    <div class="sidebar-workspace">
      <p class="nav-caption">Your workspace</p>
      <a class="nav-item" href="../Landing.html">${fa("arrow-up-right-from-square")}<span class="nav-label">View store</span></a>
      <a class="nav-item" href="../account/index.html">${fa("user")}<span class="nav-label">My account</span></a>
      <button class="nav-item" id="admin-logout" type="button">${fa("arrow-right-from-bracket")}<span class="nav-label">Log out</span></button>
    </div>
    <button class="sidebar-close icon-button" id="close-sidebar" aria-label="Close menu">${fa("xmark")}</button>
  `;
  for (const item of adminPages) {
    document.getElementById("admin-navigation").appendChild(createMenuItem(item));
  }

  const footer = document.createElement("div");
  footer.className = "sidebar-bottom";
  footer.innerHTML = `
    <button class="nav-item" id="collapse-sidebar" aria-label="Collapse menu" aria-expanded="true">
      ${fa("angles-left")}<span class="nav-label">Collapse menu</span>
    </button>
    <div class="sidebar-note">Lumeire administration</div>
  `;
  document.getElementById("admin-sidebar").appendChild(footer);
}

function loadAdminTopbar() {
  const topbar = document.querySelector(".admin-topbar");
  const oldPath = topbar.querySelector(".topbar-path");
  let path = "Lumeire";
  if (oldPath) path = oldPath.textContent;

  topbar.innerHTML = `
    <button class="icon-button" id="menu-toggle" aria-controls="admin-sidebar" aria-expanded="false" aria-label="Open menu">${fa("bars")}</button>
    <span class="topbar-path">${escapeHTML(path)}</span>
    <div class="admin-search">
      <label class="sr-only" for="admin-page-search">Search admin pages</label>
      <div class="admin-search-input">
        ${fa("magnifying-glass")}
        <input type="search" id="admin-page-search" placeholder="Search admin pages…" autocomplete="off" aria-controls="admin-search-results" aria-expanded="false">
      </div>
      <div class="admin-search-results" id="admin-search-results" hidden></div>
    </div>
    <div class="topbar-actions">
      <button class="icon-button" id="inventory-notifications" aria-label="Inventory notifications" title="Inventory notifications">${fa("bell")}</button>
      <div class="admin-identity">
        <span class="avatar" aria-label="Lumeire">L</span>
        <div class="admin-identity-text"><strong>LUMIÈRE Admin</strong><span>Store administration</span></div>
      </div>
    </div>
  `;
}

function openAdminMenu() {
  document.getElementById("admin-sidebar").classList.add("open");
  document.getElementById("sidebar-backdrop").hidden = false;
  document.getElementById("menu-toggle").setAttribute("aria-expanded", "true");
  document.body.classList.add("admin-menu-open");
  document.getElementById("close-sidebar").focus();
}

function closeAdminMenu() {
  document.getElementById("admin-sidebar").classList.remove("open");
  document.getElementById("sidebar-backdrop").hidden = true;
  document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
  document.body.classList.remove("admin-menu-open");
  if (window.innerWidth <= 850) document.getElementById("menu-toggle").focus();
}

function updateCollapsedMenu() {
  const button = document.getElementById("collapse-sidebar");
  let label = "Collapse menu";
  let icon = "angles-left";
  const collapsed = document.body.classList.contains("sidebar-is-collapsed");
  if (collapsed) {
    label = "Expand menu";
    icon = "angles-right";
  }
  button.innerHTML = fa(icon) + '<span class="nav-label">' + label + '</span>';
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", String(!collapsed));
}

function closeSearch() {
  document.getElementById("admin-search-results").hidden = true;
  document.getElementById("admin-page-search").setAttribute("aria-expanded", "false");
}

function searchAdminPages() {
  const input = document.getElementById("admin-page-search");
  const results = document.getElementById("admin-search-results");
  const query = input.value.trim().toLowerCase();
  results.innerHTML = "";
  if (query === "") { closeSearch(); return; }

  let matches = 0;
  for (const item of adminPages) {
    if (item.available && item.name.toLowerCase().includes(query)) {
      const link = document.createElement("a");
      link.href = item.file;
      link.textContent = item.name;
      results.appendChild(link);
      matches++;
    }
  }
  if (matches === 0) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "No available pages match your search.";
    results.appendChild(message);
  }
  results.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

async function showInventoryNotifications() {
  const button = document.getElementById('inventory-notifications');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = fa('spinner fa-spin');
  try {
    const data = await AdminAPI.insights();
    const total = Math.max(0, number(data.low_stock_count));
    const variants = Array.isArray(data.low_stock_products) ? data.low_stock_products.slice(0, 8) : [];
    button.removeAttribute('aria-busy');
    button.innerHTML = fa('bell');
    let html;
    if (total === 0) {
      html = '<div class="inventory-empty"><span>' + fa('check') + '</span><h3>Your stock is looking good.</h3><p>No active product variants have 5 or fewer units.</p></div>';
    } else {
      const rows = variants.map(variant => {
        const quantity = Math.max(0, number(variant.quantity));
        const id = Number(variant.product_id);
        const name = escapeHTML(variant.name || 'Product');
        const size = String(variant.size || '').toUpperCase() === 'ONE_SIZE' ? 'One size' : String(variant.size || '');
        const details = escapeHTML([variant.color, size].filter(Boolean).join(' · '));
        const content = '<span class="inventory-alert-icon' + (quantity === 0 ? ' is-empty' : '') + '">' + fa(quantity === 0 ? 'box-open' : 'boxes-stacked') + '</span><span class="inventory-alert-copy"><strong>' + name + '</strong><span>' + details + '</span></span><span class="inventory-stock-badge' + (quantity === 0 ? ' is-empty' : '') + '">' + (quantity === 0 ? 'Out of stock' : quantity + ' left') + '</span>';
        return '<li>' + (Number.isInteger(id) && id > 0 ? '<a href="ProductDetails.html?id=' + id + '" aria-label="Review ' + name + ', ' + details + '">' + content + '</a>' : '<div class="inventory-alert-row">' + content + '</div>') + '</li>';
      }).join('');
      html = '<div class="inventory-summary"><strong>' + total + '</strong><div><span>Low-stock ' + (total === 1 ? 'variant' : 'variants') + '</span><p>Review items with 5 or fewer units available.</p></div></div><ul class="inventory-alert-list">' + rows + '</ul><div class="inventory-alert-footer"><span>Showing ' + variants.length + ' of ' + total + '</span><a href="Products.html">Manage products ' + fa('arrow-right') + '</a></div>';
    }
    await Alerts.show('Inventory notifications', '', 'info', {
      icon: undefined, html, width: 600, showCloseButton: true,
      confirmButtonText: 'Done', customClass: { popup: 'admin-inventory-popup' }
    });
  } catch (error) {
    await Alerts.show('Notifications unavailable', error.message, 'error');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = fa('bell');
  }
}

loadAdminMenu();
loadAdminTopbar();
try {
  if (localStorage.getItem("eco-marc-sidebar-collapsed") === "1") document.body.classList.add("sidebar-is-collapsed");
} catch (error) {
   
}
updateCollapsedMenu();

document.getElementById("menu-toggle").addEventListener("click", function () {
  if (document.getElementById("admin-sidebar").classList.contains("open")) closeAdminMenu();
  else openAdminMenu();
});
document.getElementById("close-sidebar").addEventListener("click", closeAdminMenu);
document.getElementById("sidebar-backdrop").addEventListener("click", closeAdminMenu);
document.getElementById("collapse-sidebar").addEventListener("click", function () {
  document.body.classList.toggle("sidebar-is-collapsed");
  updateCollapsedMenu();
  try {
    let saved = "0";
    if (document.body.classList.contains("sidebar-is-collapsed")) saved = "1";
    localStorage.setItem("eco-marc-sidebar-collapsed", saved);
  } catch (error) { }
});
document.getElementById("inventory-notifications").addEventListener("click", showInventoryNotifications);
document.getElementById("admin-page-search").addEventListener("input", searchAdminPages);
document.getElementById("admin-page-search").addEventListener("keydown", function (event) {
  const firstResult = document.querySelector("#admin-search-results a");
  if ((event.key === "ArrowDown" || event.key === "Enter") && firstResult) {
    event.preventDefault();
    firstResult.focus();
    if (event.key === "Enter") firstResult.click();
  }
});
document.addEventListener("click", function (event) {
  if (!event.target.closest(".admin-search")) closeSearch();
});
window.addEventListener("resize", function () {
  if (window.innerWidth > 850) closeAdminMenu();
});
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") { closeSearch(); closeAdminMenu(); }
  const sidebar = document.getElementById("admin-sidebar");
  if (event.key === "Tab" && sidebar.classList.contains("open")) {
    const items = sidebar.querySelectorAll("a, button:not([disabled])");
    const first = items[0];
    const last = document.getElementById("close-sidebar");
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

 
document.getElementById("admin-logout").addEventListener("click", EcoAuth.logout);
EcoAuth.ready.then(function (session) {
  if (!session.user) return;
  const name = [session.user.first_name, session.user.last_name].filter(Boolean).join(" ") || "Administrator";
  document.querySelector(".admin-identity-text strong").textContent = name;
  document.querySelector(".admin-identity .avatar").textContent = session.user.first_name.slice(0, 1).toUpperCase();
}).catch(function () { });

