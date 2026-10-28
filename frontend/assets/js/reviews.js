let allReviews = [];
let currentReviewPage = 1;
let reviewsLoading = false;
const reviewsPerPage = 10;

const reviewsBody = document.getElementById("reviews-body");
const searchInput = document.getElementById("review-search");
const statusFilter = document.getElementById("review-status");
const ratingFilter = document.getElementById("review-rating");
const sortSelect = document.getElementById("review-sort");
const refreshButton = document.getElementById("refresh-reviews");
const previousButton = document.getElementById("previous-page");
const nextButton = document.getElementById("next-page");

function setReviewText(id, value) {
  document.getElementById(id).textContent = value;
}

// البحث والتصفية يتمان على البيانات التي رجعت من السيرفر.
function getFilteredReviews() {
  const searchText = searchInput.value.trim().toLowerCase();
  const filteredReviews = [];

  for (const review of allReviews) {
    const searchableText = [
      review.product_name,
      review.first_name,
      review.last_name,
      review.comment
    ].join(" ").toLowerCase();

    if (!searchableText.includes(searchText)) {
      continue;
    }
    if (statusFilter.value !== "" && review.status !== statusFilter.value) {
      continue;
    }
    if (ratingFilter.value !== "" && number(review.rating) !== Number(ratingFilter.value)) {
      continue;
    }

    filteredReviews.push(review);
  }

  filteredReviews.sort(function (firstReview, secondReview) {
    if (sortSelect.value === "rating-low") {
      return number(firstReview.rating) - number(secondReview.rating);
    } else if (sortSelect.value === "rating-high") {
      return number(secondReview.rating) - number(firstReview.rating);
    } else if (sortSelect.value === "oldest") {
      return String(firstReview.created_at).localeCompare(String(secondReview.created_at));
    } else {
      return String(secondReview.created_at).localeCompare(String(firstReview.created_at));
    }
  });

  return filteredReviews;
}

function createReviewStars(rating) {
  const score = Math.max(0, Math.min(5, Math.round(number(rating))));
  let html = "";

  for (let star = 1; star <= 5; star++) {
    if (star <= score) {
      html += '<i class="fa-solid fa-star" aria-hidden="true"></i>';
    } else {
      html += '<i class="fa-regular fa-star" aria-hidden="true"></i>';
    }
  }

  return '<div class="review-stars" aria-label="' + score + ' out of 5 stars">' + html + '</div>';
}

function createReviewButton(action, icon, label, disabled) {
  const button = document.createElement("button");
  button.className = "secondary";
  button.dataset.action = action;
  button.innerHTML = fa(icon);
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;

  if (action === "delete") {
    button.classList.add("delete-review");
  }

  return button;
}

function createReviewRow(review) {
  const row = document.createElement("tr");
  row.dataset.reviewId = review.id;

  let statusClass = "unknown";
  if (review.status === "pending" || review.status === "approved" || review.status === "hidden") {
    statusClass = review.status;
  }

  const customerName = [review.first_name, review.last_name].join(" ").trim();

  // النصوص القادمة من قاعدة البيانات تمر على escapeHTML.
  row.innerHTML = `
    <td>
      <div class="review-product">${escapeHTML(review.product_name)}</div>
      <div class="review-customer">
        ${escapeHTML(customerName)}<br>
        Review #${escapeHTML(review.id)}
      </div>
    </td>
    <td>
      ${createReviewStars(review.rating)}
      <div class="review-comment" dir="auto">${escapeHTML(review.comment)}</div>
    </td>
    <td class="review-date">${escapeHTML(displayDate(review.created_at))}</td>
    <td><span class="status ${statusClass}">${escapeHTML(review.status)}</span></td>
    <td><div class="review-actions"></div></td>
  `;

  const actions = row.querySelector(".review-actions");
  actions.appendChild(createReviewButton("approved", "check", "Approve review " + review.id, review.status === "approved"));
  actions.appendChild(createReviewButton("hidden", "eye-slash", "Hide review " + review.id, review.status === "hidden"));
  actions.appendChild(createReviewButton("pending", "clock", "Mark review " + review.id + " pending", review.status === "pending"));
  actions.appendChild(createReviewButton("delete", "trash-can", "Delete review " + review.id, false));

  return row;
}

function showReviews() {
  const filteredReviews = getFilteredReviews();
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / reviewsPerPage));
  currentReviewPage = Math.min(currentReviewPage, totalPages);

  setReviewText("review-count", filteredReviews.length + " of " + allReviews.length + " reviews");
  setReviewText("pagination-label", "Page " + currentReviewPage + " of " + totalPages);
  previousButton.disabled = reviewsLoading || currentReviewPage <= 1;
  nextButton.disabled = reviewsLoading || currentReviewPage >= totalPages;
  reviewsBody.innerHTML = "";

  if (filteredReviews.length === 0) {
    let title = "The conversation starts here.";
    let message = "Customer reviews will appear here when submitted.";

    if (allReviews.length > 0) {
      title = "No reviews match this view.";
      message = "Try a different search, rating or status.";
    }

    reviewsBody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state">
          ${fa("star")}
          <h3>${title}</h3>
          <p class="muted">${message}</p>
        </div>
      </td></tr>
    `;
    return;
  }

  const start = (currentReviewPage - 1) * reviewsPerPage;
  const pageReviews = filteredReviews.slice(start, start + reviewsPerPage);

  for (const review of pageReviews) {
    reviewsBody.appendChild(createReviewRow(review));
  }
}

function clearReviewStatistics() {
  setReviewText("total-reviews", "—");
  setReviewText("average-rating", "—");
  setReviewText("pending-reviews", "—");
  setReviewText("approved-reviews", "—");
}

async function loadReviewStatistics() {
  try {
    const statistics = await AdminAPI.reviewStats();
    if (!statistics) {
      throw new Error("Statistics were not returned.");
    }

    setReviewText("total-reviews", number(statistics.total_reviews));
    setReviewText("average-rating", number(statistics.average_rating).toFixed(1) + " / 5");
    setReviewText("pending-reviews", number(statistics.pending_reviews));
    setReviewText("approved-reviews", number(statistics.approved_reviews));
    setReviewText("stats-note", "Statistics cover all reviews, independent of the filters below.");
  } catch (error) {
    clearReviewStatistics();
    setReviewText("stats-note", "Reviews loaded, but statistics are unavailable. Refresh to retry.");
  }
}

function setReviewsLoading(loading) {
  reviewsLoading = loading;
  refreshButton.disabled = loading;
  previousButton.disabled = true;
  nextButton.disabled = true;

  const actionButtons = reviewsBody.querySelectorAll("button");
  for (const button of actionButtons) {
    button.disabled = loading;
  }
}

async function loadReviews() {
  if (reviewsLoading) {
    return;
  }

  setReviewsLoading(true);
  document.getElementById("reviews-error").hidden = true;
  reviewsBody.innerHTML = `
    <tr><td colspan="5">
      <div class="loading">
        <span class="spinner"></span>
        <p>Loading customer reviews…</p>
      </div>
    </td></tr>
  `;

  try {
    allReviews = await AdminAPI.reviews();
    await loadReviewStatistics();

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    setReviewText("reviews-updated", "Updated " + time);

    setReviewsLoading(false);
    showReviews();
  } catch (error) {
    allReviews = [];
    setReviewsLoading(false);
    clearReviewStatistics();
    document.getElementById("reviews-error").hidden = false;
    setReviewText("reviews-error-text", error.message);
    setReviewText("review-count", "Unavailable");
    setReviewText("reviews-updated", "Could not load reviews.");
    reviewsBody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state">
          <h3>Reviews could not load.</h3>
          <p class="muted">Resolve the connection issue above and retry.</p>
        </div>
      </td></tr>
    `;
  }
}

async function handleReviewAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || reviewsLoading) {
    return;
  }

  const row = button.closest("[data-review-id]");
  const reviewId = Number(row.dataset.reviewId);
  const action = button.dataset.action;

  // نمنع الضغط على أكثر من عملية أثناء التأكيد أو الحفظ.
  setReviewsLoading(true);

  if (action === "delete" || action === "hidden") {
    let title = "Hide this review?";
    let message = "The review will no longer be approved for storefront display.";
    if (action === "delete") {
      title = "Delete this review?";
      message = "This permanently removes the review from your database.";
    }

    const confirmation = await Alerts.confirm(title, message);
    if (!confirmation.isConfirmed) {
      setReviewsLoading(false);
      showReviews();
      return;
    }
  }

  try {
    if (action === "delete") {
      await AdminAPI.deleteReview(reviewId);
      Alerts.toast("Review deleted");
    } else {
      await AdminAPI.setReviewStatus(reviewId, action);
      Alerts.toast("Review status updated");
    }

    setReviewsLoading(false);
    await loadReviews();
  } catch (error) {
    setReviewsLoading(false);
    showReviews();
    Alerts.show("Review was not changed", error.message, "error");
  }
}

function applyReviewFilters() {
  if (!reviewsLoading) {
    currentReviewPage = 1;
    showReviews();
  }
}

searchInput.addEventListener("input", applyReviewFilters);
statusFilter.addEventListener("change", applyReviewFilters);
ratingFilter.addEventListener("change", applyReviewFilters);
sortSelect.addEventListener("change", applyReviewFilters);
reviewsBody.addEventListener("click", handleReviewAction);

previousButton.addEventListener("click", function () {
  if (!reviewsLoading && currentReviewPage > 1) {
    currentReviewPage--;
    showReviews();
  }
});

nextButton.addEventListener("click", function () {
  if (!reviewsLoading) {
    currentReviewPage++;
    showReviews();
  }
});

document.getElementById("clear-filters").addEventListener("click", function () {
  searchInput.value = "";
  statusFilter.value = "";
  ratingFilter.value = "";
  sortSelect.value = "newest";
  applyReviewFilters();
});

refreshButton.addEventListener("click", loadReviews);
document.getElementById("retry-reviews").addEventListener("click", loadReviews);

loadReviews();
