const ProductReviews = (() => {
  const section = document.getElementById("product-reviews");
  const C = StoreCommon;
  const list = document.getElementById("public-reviews-list");
  const editor = document.getElementById("review-editor");
  const form = document.getElementById("product-review-form");
  const comment = document.getElementById("review-comment");
  let productId = null, page = 1, pages = 1, ratingFilter = null, ownReview = null, signedIn = false, loading = false, saving = false, initialized = false;

  let reviewCount = 0;
  let reviewsLoaded = false;
  const commentsPanel = document.getElementById("reviews-comments-panel");
  const commentsToggle = document.getElementById("reviews-toggle");
  function showComments(open) {
    commentsPanel.hidden = !open;
    commentsToggle.setAttribute("aria-expanded", String(open));
    commentsToggle.innerHTML = (open ? "Hide comments" : "View comments (" + reviewCount + ")") + '<i class="fa-solid fa-chevron-' + (open ? "up" : "down") + '" aria-hidden="true"></i>';
  }
  commentsToggle.addEventListener("click", () => showComments(commentsPanel.hidden));

  function stars(value) {
    const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return '<span class="public-review-stars" role="img" aria-label="' + rating + ' out of 5 stars">' + Array.from({length: 5}, (_, index) => '<i class="fa-' + (index < rating ? 'solid' : 'regular') + ' fa-star" aria-hidden="true"></i>').join("") + '</span>';
  }

  function setBusy() {
    list.setAttribute("aria-busy", String(loading));
    commentsToggle.disabled = !reviewsLoaded || loading || saving;
    section.querySelectorAll('#reviews-sort,#reviews-retry,#reviews-clear-rating,[data-rating-filter]').forEach(control => control.disabled = loading || saving);
    document.getElementById("reviews-prev").disabled = loading || saving || page <= 1;
    document.getElementById("reviews-next").disabled = loading || saving || page >= pages;
    document.getElementById("review-write").disabled = loading || saving;
    form.querySelectorAll("input,textarea,button").forEach(control => control.disabled = saving || loading);
    document.getElementById("review-submit").textContent = saving ? "Sending…" : ownReview ? "Update review" : "Submit review";
  }

  function updateRating() {
    const rating = Number(form.querySelector('input[name="product_rating"]:checked')?.value || 0);
    section.querySelectorAll("[data-review-star]").forEach(label => label.classList.toggle("is-filled", Number(label.dataset.reviewStar) <= rating));
    document.getElementById("review-rating-label").textContent = rating ? ["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating] : "Choose your rating";
    document.getElementById("review-comment-count").textContent = Array.from(comment.value).length + " / 2000";
  }

  function fillOwnReview() {
    form.reset();
    if (ownReview) {
      const radio = form.querySelector('input[name="product_rating"][value="' + Number(ownReview.rating) + '"]');
      if (radio) radio.checked = true;
      comment.value = ownReview.comment || "";
    }
    const notice = document.getElementById("review-own-notice");
    notice.hidden = !ownReview;
    notice.textContent = ownReview?.status === "approved" ? "Your review is published. Updating it sends it back to our team for review." : ownReview?.status === "pending" ? "Thank you. Your review is awaiting moderation and will appear once approved." : ownReview ? "Your review is not published. You can update it and send it for review again." : "";
    document.getElementById("review-write").innerHTML = (signedIn ? ownReview ? "Edit your review" : "Write a review" : "Sign in to review") + ' <i class="fa-regular fa-pen-to-square" aria-hidden="true"></i>';
    editor.hidden = !signedIn;
    document.getElementById("review-form-error").hidden = true;
    updateRating();
  }

  function renderReviews(data) {
    const summary = data.summary;
    reviewCount = Number(summary.total) || 0;
    reviewsLoaded = true;
    showComments(!commentsPanel.hidden);
    page = Number(data.pagination.page);
    pages = Number(data.pagination.pages);
    document.getElementById("reviews-average").textContent = summary.total ? Number(summary.average).toFixed(1) : "—";
    document.getElementById("reviews-summary-stars").innerHTML = stars(summary.average);
    document.getElementById("reviews-total").textContent = summary.total + (Number(summary.total) === 1 ? " review" : " reviews");
    document.getElementById("reviews-distribution").innerHTML = [5,4,3,2,1].map(rating => {
      const count = Number(summary.distribution[rating]) || 0;
      const percentage = summary.total ? count / Number(summary.total) * 100 : 0;
      return `<button type="button" data-rating-filter="${rating}" aria-pressed="${ratingFilter === rating}" aria-label="Show ${rating}-star reviews, ${count} reviews"><span>${rating} <i class="fa-solid fa-star" aria-hidden="true"></i></span><span class="public-rating-track"><span style="width:${percentage}%"></span></span><span>${count}</span></button>`;
    }).join("");
    document.getElementById("reviews-result-count").textContent = data.pagination.total + (ratingFilter ? " reviews with " + ratingFilter + " stars" : " reviews");
    document.getElementById("reviews-clear-rating").hidden = ratingFilter === null;
    document.getElementById("reviews-page-label").textContent = "Page " + page + " of " + pages;
    list.innerHTML = data.items.map(review => {
      const date = new Date(String(review.created_at || "").replace(" ", "T"));
      const label = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"});
      return `<article class="public-review"><div class="public-review-heading"><div><strong>${C.escapeHtml(review.display_name || "Customer")}</strong>${stars(review.rating)}</div><time>${C.escapeHtml(label)}</time></div><p dir="auto">${C.escapeHtml(review.comment || "")}</p></article>`;
    }).join("") || '<div class="public-review-empty"><i class="fa-regular fa-comment" aria-hidden="true"></i><h3>' + (ratingFilter ? "No reviews with this rating yet." : "The conversation starts here.") + '</h3><p>' + (ratingFilter ? "Choose another rating or show all reviews." : "Share your experience with this product.") + '</p></div>';
  }

  async function loadReviews(resetEditor = false) {
    if (loading) return;
    loading = true;
    document.getElementById("reviews-error").hidden = true;
    setBusy();
    try {
      const params = new URLSearchParams({product_id: productId, page, sort: document.getElementById("reviews-sort").value});
      if (ratingFilter) params.set("rating", ratingFilter);
      const result = await C.request("product-reviews.php?" + params);
      if (!result.data || !Array.isArray(result.data.items) || !result.data.summary || !result.data.pagination) throw new Error("Reviews could not load. Please retry.");
      renderReviews(result.data);
      ownReview = result.data.own_review;
      if (resetEditor) fillOwnReview();
    } catch (error) {
      document.getElementById("reviews-error-text").textContent = error.message;
      document.getElementById("reviews-error").hidden = false;
      if (!list.children.length) {
        document.getElementById("reviews-result-count").textContent = "Reviews unavailable";
        document.getElementById("reviews-total").textContent = "Reviews unavailable";
      }
    } finally { loading = false; setBusy(); }
  }

  async function init(id) {
    if (!section || initialized) return;
    initialized = true;
    productId = Number(id);
    const session = await EcoAuth.ready;
    signedIn = Boolean(session?.user);
    section.hidden = false;
    await loadReviews(true);
  }

  document.getElementById("review-write").addEventListener("click", async () => {
    if (!(await C.requireLogin())) return;
    editor.hidden = false;
    editor.open = true;
    editor.scrollIntoView({block: "center", behavior: "auto"});
    form.querySelector('input[name="product_rating"]')?.focus({preventScroll: true});
  });
  form.addEventListener("change", updateRating);
  comment.addEventListener("input", () => {updateRating(); document.getElementById("review-form-error").hidden = true; comment.removeAttribute("aria-invalid");});
  document.getElementById("review-cancel").addEventListener("click", () => {fillOwnReview(); editor.open = false; document.getElementById("review-write").focus({preventScroll: true});});
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving || loading) return;
    const rating = Number(form.querySelector('input[name="product_rating"]:checked')?.value || 0);
    const text = comment.value.trim();
    const errorBox = document.getElementById("review-form-error");
    if (!rating || !text || Array.from(text).length > 2000) {
      errorBox.textContent = !rating ? "Choose your rating from 1 to 5 stars." : "Write a comment of 1–2,000 characters.";
      errorBox.hidden = false;
      if (!rating) form.querySelector('input[name="product_rating"]').focus();
      else {comment.setAttribute("aria-invalid", "true"); comment.focus();}
      return;
    }
    if (!(await C.requireLogin())) return;
    saving = true;
    errorBox.hidden = true;
    setBusy();
    try {
      const result = await C.request("product-reviews.php", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({product_id: productId, rating, comment: text})});
      ownReview = result.data;
      fillOwnReview();
      editor.open = false;
      Alerts.toast("Review sent for moderation");
      await loadReviews(true);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      Alerts.show("Review was not sent", error.message, "error");
    } finally {saving = false; setBusy();}
  });
  document.getElementById("reviews-sort").addEventListener("change", () => {page = 1; loadReviews();});
  document.getElementById("reviews-distribution").addEventListener("click", event => {
    const button = event.target.closest("[data-rating-filter]");
    if (!button || loading || saving) return;
    showComments(true);
    ratingFilter = Number(button.dataset.ratingFilter);
    page = 1;
    loadReviews();
  });
  document.getElementById("reviews-clear-rating").addEventListener("click", () => {ratingFilter = null; page = 1; loadReviews();});
  document.getElementById("reviews-retry").addEventListener("click", () => loadReviews(true));
  document.getElementById("reviews-prev").addEventListener("click", () => {if (page > 1 && !loading) {page--; loadReviews();}});
  document.getElementById("reviews-next").addEventListener("click", () => {if (page < pages && !loading) {page++; loadReviews();}});
  return {init};
})();
