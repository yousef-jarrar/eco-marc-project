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
  button.innerHTML = fa(icon) + "<span>" + ({approved: "Publish", hidden: "Hide", pending: "Pending", delete: "Delete"}[action] || action) + "</span>";
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

   
  row.innerHTML = `
    <td class="review-person-cell">
      <div class="review-product">${escapeHTML(review.product_name)}</div>
      <div class="review-customer">
        ${escapeHTML(customerName)}<br>
        Review #${escapeHTML(review.id)}
      </div>
    </td>
    <td class="review-content-cell">
      ${createReviewStars(review.rating)}
      <div class="review-comment" dir="auto">${escapeHTML(review.comment || "No written feedback.")}</div>
    </td>
    <td class="review-date">${escapeHTML(displayDate(review.created_at))}</td>
    <td class="review-status-cell"><span class="status ${statusClass}">${escapeHTML(({approved: "Published", pending: "Pending", hidden: "Hidden"})[review.status] || "Unknown")}</span></td>
    <td class="review-actions-cell"><div class="review-actions"></div></td>
  `;

  if (String(review.comment || "").length > 220) {
    const comment = row.querySelector(".review-comment");
    comment.classList.add("is-collapsed");
    const toggle = document.createElement("button");
    toggle.className = "review-read-more";
    toggle.type = "button";
    toggle.textContent = "Read full review";
    toggle.setAttribute("aria-expanded", "false");
    comment.id = "review-comment-" + Number(review.id);
    toggle.setAttribute("aria-controls", comment.id);
    toggle.addEventListener("click", function () {
      const collapsed = comment.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? "Read full review" : "Show less";
    });
    comment.after(toggle);
  }
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
  setReviewText("pagination-label", (filteredReviews.length ? ((currentReviewPage - 1) * reviewsPerPage + 1) + "–" + Math.min(currentReviewPage * reviewsPerPage, filteredReviews.length) : "0") + " of " + filteredReviews.length + " · Page " + currentReviewPage + " of " + totalPages);
  previousButton.disabled = reviewsLoading || currentReviewPage <= 1;
  nextButton.disabled = reviewsLoading || currentReviewPage >= totalPages;
  updateReviewOverview();
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
    setReviewText("stats-note", "Statistics cover all reviews, independent of the filters above.");
  } catch (error) {
    clearReviewStatistics();
    setReviewText("stats-note", "Reviews loaded, but statistics are unavailable. Refresh to retry.");
  }
}

function setReviewsLoading(loading) {
  reviewsLoading = loading;
  refreshButton.disabled = loading;
  document.querySelector(".reviews-panel").setAttribute("aria-busy", String(loading));
  refreshButton.innerHTML = fa(loading ? "spinner fa-spin" : "rotate") + (loading ? " Updating…" : " Refresh");
  document.querySelectorAll(".reviews-toolbar input, .reviews-toolbar select, .reviews-toolbar button, [data-review-status], #view-pending").forEach(function (control) { control.disabled = loading; });
  document.querySelectorAll(".rating-breakdown-row").forEach(function (button) { button.disabled = loading; });
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
    updateReviewOverview();
    setReviewText("pagination-label", "Reviews unavailable");
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

   
  setReviewsLoading(true);

  if (action === "delete" || action === "hidden") {
    let title = "Hide this review?";
    let message = "The review will no longer appear on product pages. You can publish it again later.";
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
      Alerts.toast(action === "approved" ? "Review published" : action === "hidden" ? "Review hidden" : "Review marked pending");
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

function updateReviewOverview() {
  document.querySelectorAll("[data-status-count]").forEach(function (counter) {
    const status = counter.dataset.statusCount;
    counter.textContent = status ? allReviews.filter(function (review) { return review.status === status; }).length : allReviews.length;
  });
  document.querySelectorAll("[data-review-status]").forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.reviewStatus === statusFilter.value));
  });
  const breakdown = document.getElementById("rating-breakdown");
  breakdown.replaceChildren();
  for (let rating = 5; rating >= 1; rating--) {
    const count = allReviews.filter(function (review) { return number(review.rating) === rating; }).length;
    const percentage = allReviews.length ? Math.round(count / allReviews.length * 100) : 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rating-breakdown-row";
    button.disabled = reviewsLoading;
    button.setAttribute("aria-label", rating + " stars, " + count + " reviews. Filter by this rating");
    button.setAttribute("aria-pressed", String(ratingFilter.value === String(rating)));
    button.innerHTML = '<span>' + rating + ' ' + fa("star") + '</span><span class="rating-track"><span style="width:' + percentage + '%"></span></span><span>' + count + '</span>';
    button.addEventListener("click", function () {
      ratingFilter.value = ratingFilter.value === String(rating) ? "" : String(rating);
      applyReviewFilters();
    });
    breakdown.appendChild(button);
  }
}

document.querySelectorAll("[data-review-status]").forEach(function (button) {
  button.addEventListener("click", function () {
    statusFilter.value = button.dataset.reviewStatus;
    applyReviewFilters();
  });
});
document.getElementById("view-pending").addEventListener("click", function () {
  searchInput.value = "";
  ratingFilter.value = "";
  statusFilter.value = "pending";
  applyReviewFilters();
  document.querySelector(".review-views").scrollIntoView({block: "center"});
});
