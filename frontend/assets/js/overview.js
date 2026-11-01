const overviewForm = document.getElementById("overview-period");
const overviewFrom = document.getElementById("overview-from");
const overviewTo = document.getElementById("overview-to");
const overviewAllDates = document.getElementById("overview-all-dates");
const overviewRetry = document.getElementById("overview-retry");
const overviewError = document.getElementById("overview-error");
const overviewErrorText = document.getElementById("overview-error-text");
const overviewStatus = document.getElementById("overview-status");
const overviewChart = document.getElementById("overview-chart");
const overviewChartEmpty = document.getElementById("overview-chart-empty");
const overviewStatusChart = document.getElementById("overview-status-chart");
const overviewStatusEmpty = document.getElementById("overview-status-empty");
const overviewCategoryChart = document.getElementById("overview-category-chart");
const overviewCategoryEmpty = document.getElementById("overview-category-empty");
const overviewDailyBody = document.getElementById("overview-daily-body");
const overviewCategoryList = document.getElementById("overview-category-list");
const overviewOrdersBody = document.getElementById("overview-orders-body");
const overviewTopProducts = document.getElementById("overview-top-products");
const overviewInventoryList = document.getElementById("overview-inventory-list");
const overviewReviewsList = document.getElementById("overview-reviews-list");
const overviewOrderDialog = document.getElementById("overview-order-dialog");
const overviewOrderDetails = document.getElementById("overview-order-details");

let overviewLoading = false;
let overviewRevenueChart = null;
let overviewOrderStatusChart = null;
let overviewCategoryRevenueChart = null;
let recentOverviewOrders = [];
const overviewTheme = getComputedStyle(document.documentElement);
const overviewColor = name => overviewTheme.getPropertyValue(name).trim();
const overviewChartColors = Array.from({length:8}, (_, index) => overviewColor("--chart-" + (index + 1)));
if (window.Chart) {
  Chart.defaults.color = overviewColor("--color-text-muted");
  Chart.defaults.borderColor = overviewColor("--color-border");
}

function overviewToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = {};
  for (const part of parts) values[part.type] = part.value;
  return values.year + "-" + values.month + "-" + values.day;
}

function overviewShiftDate(value, days) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function overviewFormatMoney(value) {
  return "JOD " + number(value).toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function overviewFormatDate(value) {
  const date = new Date(String(value) + "T12:00:00");
  if (Number.isNaN(date.getTime())) return String(value || "—");
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function showOverviewError(message) {
  overviewErrorText.textContent = message;
  overviewError.hidden = false;
  overviewStatus.className = "status hidden";
  overviewStatus.textContent = "Update unavailable";
  document.getElementById("overview-updated").textContent =
    "Could not refresh. Any figures shown are from the last successful report.";
}

function renderOverviewChart(rows) {
  if (overviewRevenueChart) {
    overviewRevenueChart.destroy();
    overviewRevenueChart = null;
  }

  if (rows.length === 0) {
    overviewChart.hidden = true;
    overviewChartEmpty.hidden = false;
    overviewChartEmpty.textContent = "No eligible revenue records in this period.";
    return;
  }

  if (!window.Chart) {
    overviewChart.hidden = true;
    overviewChartEmpty.hidden = false;
    overviewChartEmpty.textContent = "The chart is unavailable. Revenue records are shown in the table.";
    return;
  }

  overviewChart.hidden = false;
  overviewChartEmpty.hidden = true;
  overviewRevenueChart = new Chart(overviewChart, {
    type: "line",
    data: {
      labels: rows.map(function (row) { return overviewFormatDate(row.sale_date); }),
      datasets: [{
        label: "Revenue (JOD)",
        data: rows.map(function (row) { return number(row.revenue); }),
        borderColor: overviewColor("--color-primary"),
        backgroundColor: "rgba(" + overviewColor("--rgb-primary") + ", .09)",
        borderWidth: 2,
        fill: true,
        tension: 0.25
      }]
    },
    options: {
      animation: matchMedia("(prefers-reduced-motion: reduce)").matches ? false : {duration: 650},
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: overviewColor("--color-border") } },
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }
      }
    }
  });
}

function renderOrderStatusChart(rows) {
  if (overviewOrderStatusChart) {
    overviewOrderStatusChart.destroy();
    overviewOrderStatusChart = null;
  }

  const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  const totals = new Map(rows.map(function (row) {
    return [String(row.status).toLowerCase(), number(row.total)];
  }));
  const values = statuses.map(function (status) { return totals.get(status) || 0; });
  const labels = statuses.map(function (status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  });

  if (rows.length === 0 || values.every(function (value) { return value === 0; })) {
    overviewStatusChart.hidden = true;
    overviewStatusEmpty.hidden = false;
    overviewStatusEmpty.textContent = "No order records in this period.";
    return;
  }
  if (!window.Chart) {
    overviewStatusChart.hidden = true;
    overviewStatusEmpty.hidden = false;
    overviewStatusEmpty.textContent = "The chart is unavailable.";
    return;
  }

  overviewStatusChart.hidden = false;
  overviewStatusEmpty.hidden = true;
  overviewOrderStatusChart = new Chart(overviewStatusChart, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: overviewChartColors.slice(0, statuses.length),
        borderWidth: 0,
        hoverOffset: 5
      }]
    },
    options: {
      animation: matchMedia("(prefers-reduced-motion: reduce)").matches ? false : {duration: 650},
      responsive: true,
      maintainAspectRatio: false,
      cutout: "43%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 14, boxHeight: 8, padding: 8, font: { size: 10 } }
        }
      }
    }
  });
}

function renderCategoryRevenue(rows) {
  if (overviewCategoryRevenueChart) {
    overviewCategoryRevenueChart.destroy();
    overviewCategoryRevenueChart = null;
  }

  overviewCategoryList.replaceChildren();
  if (rows.length === 0) {
    overviewCategoryChart.hidden = true;
    overviewCategoryEmpty.hidden = false;
    overviewCategoryEmpty.textContent = "No category sales in this period.";
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No matching category sales.";
    overviewCategoryList.appendChild(empty);
    return;
  }

  const categories = rows.slice(0, 8);
  if (window.Chart) {
    overviewCategoryChart.hidden = false;
    overviewCategoryEmpty.hidden = true;
    overviewCategoryRevenueChart = new Chart(overviewCategoryChart, {
      type: "bar",
      data: {
        labels: categories.map(function (row) { return row.name; }),
        datasets: [{
          label: "Estimated item sales (JOD)",
          data: categories.map(function (row) { return number(row.revenue); }),
          backgroundColor: categories.map(function (_, index) {
            return overviewChartColors[index % overviewChartColors.length];
          }),
          borderWidth: 0
        }]
      },
      options: {
        animation: matchMedia("(prefers-reduced-motion: reduce)").matches ? false : {duration: 650},
      responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: overviewColor("--color-border") } },
          x: { grid: { display: false }, ticks: { maxRotation: 35, minRotation: 25 } }
        }
      }
    });
  } else {
    overviewCategoryChart.hidden = true;
    overviewCategoryEmpty.hidden = false;
    overviewCategoryEmpty.textContent = "The chart is unavailable. Category totals are shown below.";
  }

  for (const category of categories) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const revenue = document.createElement("strong");
    name.textContent = category.name;
    revenue.textContent = overviewFormatMoney(category.revenue);
    item.append(name, revenue);
    overviewCategoryList.appendChild(item);
  }
}

function renderOverviewTable(rows) {
  overviewDailyBody.replaceChildren();
  if (rows.length === 0) {
    const row = overviewDailyBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.textContent = "No eligible revenue records were returned for this period.";
    return;
  }

  for (const item of rows) {
    const row = overviewDailyBody.insertRow();
    row.insertCell().textContent = String(item.sale_date);
    row.insertCell().textContent = String(number(item.total_orders));
    row.insertCell().textContent = overviewFormatMoney(item.revenue);
  }
}

function addOverviewEmptyRow(container, columnCount, message) {
  const row = container.insertRow();
  const cell = row.insertCell();
  cell.colSpan = columnCount;
  cell.className = "muted";
  cell.textContent = message;
}

function renderRecentOrders(orders) {
  recentOverviewOrders = orders;
  overviewOrdersBody.replaceChildren();
  if (orders.length === 0) {
    addOverviewEmptyRow(overviewOrdersBody, 8, "No orders were found in this period.");
    return;
  }

  for (const order of orders) {
    const row = overviewOrdersBody.insertRow();
    row.className = "overview-order-row";
    const customer = [order.first_name, order.last_name].filter(Boolean).join(" ");
    const orderNumber = document.createElement("strong");
    orderNumber.textContent = "EM-" + String(order.id).padStart(4, "0");
    const cells = [
      ["Order", orderNumber],
      ["Customer", customer || "Customer"],
      ["Date", String(order.placed_at || order.created_at || "").slice(0, 10)],
      ["Items", number(order.item_count) + (number(order.item_count) === 1 ? " item" : " items")],
      ["Total", overviewFormatMoney(order.total)],
      ["Payment", "Not recorded"]
    ];
    for (const [label, value] of cells) {
      const cell = row.insertCell();
      cell.dataset.label = label;
      if (value instanceof Node) {
        cell.appendChild(value);
      } else {
        cell.textContent = value;
      }
    }

    const statusCell = row.insertCell();
    statusCell.dataset.label = "Status";
    const status = document.createElement("span");
    status.className = "status overview-order-status";
    status.textContent = String(order.status || "unknown");
    status.dataset.state = String(order.status || "unknown");
    statusCell.appendChild(status);

    const actionCell = row.insertCell();
    actionCell.dataset.label = "Details";
    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "secondary overview-details-button";
    detailsButton.dataset.orderId = String(order.id);
    detailsButton.textContent = "View details";
    actionCell.appendChild(detailsButton);
  }
}

function renderOverviewTopProducts(products) {
  overviewTopProducts.replaceChildren();
  if (products.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No eligible product sales in this period.";
    overviewTopProducts.appendChild(empty);
    return;
  }

  for (const product of products) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const units = document.createElement("strong");
    name.textContent = product.name;
    const productId=Number(product.product_id ?? product.id);
    if(Number.isInteger(productId)&&productId>0){const link=document.createElement("a");link.href="ProductDetails.html?id="+productId;link.textContent=name.textContent;name.replaceChildren(link);}
    item.dataset.rank=String(overviewTopProducts.children.length+1);
    units.textContent = number(product.units_sold) + (number(product.units_sold) === 1 ? " unit" : " units");
    item.append(name, units);
    overviewTopProducts.appendChild(item);
  }
}

function renderInventoryAttention(products, totalCount) {
  overviewInventoryList.replaceChildren();
  document.getElementById("overview-inventory-count").textContent = totalCount + " products";
  if (products.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No active products need inventory attention.";
    overviewInventoryList.appendChild(empty);
    return;
  }

  for (const product of products) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const quantity = document.createElement("strong");
    name.textContent = product.name;
    const productId=Number(product.product_id ?? product.id);
    if(Number.isInteger(productId)&&productId>0){const link=document.createElement("a");link.href="ProductDetails.html?id="+productId;link.textContent=name.textContent;name.replaceChildren(link);}
    quantity.textContent = "Lowest variant: " + number(product.minimum_quantity);
    quantity.dataset.low = String(number(product.minimum_quantity)===0);
    item.append(name, quantity);
    overviewInventoryList.appendChild(item);
  }
}

function renderRecentReviews(reviews) {
  overviewReviewsList.replaceChildren();
  if (reviews.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No customer reviews have been submitted yet.";
    overviewReviewsList.appendChild(empty);
    return;
  }

  for (const review of reviews) {
    const item = document.createElement("article");
    item.className = "overview-review";
    const heading = document.createElement("div");
    heading.className = "overview-review-heading";
    const product = document.createElement("strong");
    const rating = document.createElement("strong");
    product.textContent = review.product_name;
    rating.className = "overview-review-rating";
    const star=document.createElement("i"); star.className="fa-solid fa-star"; star.setAttribute("aria-hidden","true");
    rating.append(star,document.createTextNode(" "+number(review.rating)+"/5"));
    heading.append(product, rating);

    const author = document.createElement("p");
    author.className = "tiny muted";
    author.textContent = [review.first_name, review.last_name].filter(Boolean).join(" ") || "Customer";

    const comment = document.createElement("p");
    comment.className = "overview-review-comment";
    comment.textContent = review.comment || "No written comment.";
    comment.dir = "auto";

    const meta = document.createElement("div");
    meta.className = "overview-review-meta";
    const date = document.createElement("span");
    date.textContent = overviewFormatDate(String(review.created_at || "").slice(0, 10));
    const status = document.createElement("span");
    status.className = "status";
    status.textContent = String(review.status || "unknown");
    meta.append(date, status);
    item.append(heading, author, comment, meta);
    overviewReviewsList.appendChild(item);
  }
}

function showOverviewOrderDetails(orderId) {
  const order = recentOverviewOrders.find(function (item) {
    return String(item.id) === String(orderId);
  });
  if (!order) return;

  const fields = [
    ["Order", "EM-" + String(order.id).padStart(4, "0")],
    ["Customer", [order.first_name, order.last_name].filter(Boolean).join(" ") || "Customer"],
    ["Date", String(order.placed_at || order.created_at || "").slice(0, 10)],
    ["Items", number(order.item_count)],
    ["Total", overviewFormatMoney(order.total)],
    ["Payment", "Not recorded"],
    ["Status", String(order.status || "unknown")]
  ];
  overviewOrderDetails.replaceChildren();
  for (const field of fields) {
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = field[0];
    value.textContent = String(field[1]);
    overviewOrderDetails.append(term, value);
  }
  overviewOrderDialog.showModal();
}

function renderOverview(data) {
  if (!data.summary || !data.period || !Array.isArray(data.daily_revenue)) {
    throw new Error("The store returned an incomplete report.");
  }

  const summary = data.summary;
  document.getElementById("overview-revenue").textContent = overviewFormatMoney(summary.revenue);
  document.getElementById("overview-orders").textContent = String(number(summary.total_orders));
  document.getElementById("overview-customers").textContent = String(number(summary.customers));
  document.getElementById("overview-products").textContent = String(number(data.total_products));
  document.getElementById("overview-categories").textContent = String(number(data.total_categories));
  document.getElementById("overview-average").textContent = overviewFormatMoney(summary.average_order_value);

  const range = data.period.from + " — " + data.period.to;
  document.getElementById("overview-revenue-note").textContent = "After discounts, including delivery";
  document.getElementById("overview-orders-note").textContent = "Eligible orders in the selected period";
  document.getElementById("overview-customers-note").textContent = "Customers with eligible orders";
  document.getElementById("overview-chart-period").textContent = range;
  document.getElementById("overview-status-period").textContent = range;
  document.getElementById("overview-period-note").textContent =
    "Showing " + range + " · Asia/Amman";

  renderOverviewChart(data.daily_revenue);
  renderOrderStatusChart(Array.isArray(data.orders_by_status) ? data.orders_by_status : []);
  renderOverviewTable(data.daily_revenue);
  renderCategoryRevenue(Array.isArray(data.revenue_by_category) ? data.revenue_by_category : []);
  renderRecentOrders(Array.isArray(data.recent_orders) ? data.recent_orders : []);
  renderOverviewTopProducts(Array.isArray(data.top_selling_products) ? data.top_selling_products : []);
  renderInventoryAttention(
    Array.isArray(data.inventory_attention) ? data.inventory_attention : [],
    number(data.inventory_attention_count)
  );
  renderRecentReviews(Array.isArray(data.recent_reviews) ? data.recent_reviews : []);
  overviewStatus.className = "status ready";
  overviewStatus.textContent = "Up to date";
  document.getElementById("overview-updated").textContent =
    "Updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function loadOverview() {
  if (overviewLoading) return;
  const today = overviewToday();
  if (!overviewFrom.value || !overviewTo.value) {
    showOverviewError("Choose both a start date and an end date.");
    return;
  }
  if (overviewFrom.value > overviewTo.value) {
    showOverviewError("The start date must be before the end date.");
    return;
  }
  if (overviewTo.value > today) {
    showOverviewError("Reports cannot include future dates.");
    return;
  }
  const days = (Date.parse(overviewTo.value) - Date.parse(overviewFrom.value)) / 86400000 + 1;
  if (days > 366) {
    showOverviewError("Choose a reporting period of 366 days or less.");
    return;
  }

  overviewLoading = true;
  setOverviewBusy(true);
  updateOverviewPresets();
  overviewError.hidden = true;
  overviewStatus.className = "status";
  overviewStatus.textContent = "Updating";
  overviewForm.querySelectorAll("input, button").forEach(function (control) {
    control.disabled = true;
  });

  try {
    const data = await AdminAPI.overview(overviewFrom.value, overviewTo.value);
    renderOverview(data);
  } catch (error) {
    showOverviewError(error.message);
  } finally {
    overviewLoading = false;
    setOverviewBusy(false);
    overviewForm.querySelectorAll("input, button").forEach(function (control) {
      control.disabled = false;
    });
  }
}

function setDefaultOverviewPeriod() {
  const today = overviewToday();
  overviewFrom.value = overviewShiftDate(today, -29);
  overviewTo.value = today;
  overviewFrom.max = today;
  overviewTo.max = today;
}

overviewForm.addEventListener("submit", function (event) {
  event.preventDefault();
  loadOverview();
});
overviewAllDates.addEventListener("click", function () {
  const today = overviewToday();
  overviewFrom.value = overviewShiftDate(today, -365);
  overviewTo.value = today;
  loadOverview();
});
overviewRetry.addEventListener("click", loadOverview);
overviewOrdersBody.addEventListener("click", function (event) {
  const button = event.target.closest("[data-order-id]");
  if (button) showOverviewOrderDetails(button.dataset.orderId);
});
document.getElementById("overview-dialog-close").addEventListener("click", function () {
  overviewOrderDialog.close();
});
overviewOrderDialog.addEventListener("click", function (event) {
  if (event.target === overviewOrderDialog) overviewOrderDialog.close();
});


function overviewRange(key) {
  const today=overviewToday();
  const from=key==='today'?today:key==='week'?overviewShiftDate(today,-6):key==='month'?overviewShiftDate(today,-29):today.slice(0,7)+'-01';
  return {from,to:today};
}
let overviewPreferredPreset = 'month';
function updateOverviewPresets() {
  const buttons=[...document.querySelectorAll('[data-overview-range]')];
  const matches=buttons.filter(button=>{const range=overviewRange(button.dataset.overviewRange);return overviewFrom.value===range.from&&overviewTo.value===range.to;});
  const active=matches.find(button=>button.dataset.overviewRange===overviewPreferredPreset)||matches[0];
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button===active)));
}
function setOverviewBusy(busy) {
  document.querySelector('.overview-main').classList.toggle('is-refreshing',busy);
  document.querySelector('.overview-metrics').setAttribute('aria-busy',String(busy));
  document.querySelectorAll('[data-overview-range],#overview-refresh').forEach(button=>button.disabled=busy);
  const refresh=document.getElementById('overview-refresh');
  refresh.setAttribute('aria-busy',String(busy));
  refresh.querySelector('span').textContent=busy?'Refreshing…':'Refresh';
}
document.querySelectorAll('[data-overview-range]').forEach(button=>button.addEventListener('click',()=>{
  overviewPreferredPreset=button.dataset.overviewRange;
  const range=overviewRange(button.dataset.overviewRange);
  overviewFrom.value=range.from;overviewTo.value=range.to;loadOverview();
}));
document.getElementById('overview-refresh').addEventListener('click',loadOverview);
overviewFrom.addEventListener('input',updateOverviewPresets);
overviewTo.addEventListener('input',updateOverviewPresets);

setDefaultOverviewPeriod();
loadOverview();
