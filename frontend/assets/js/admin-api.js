// إعدادات الاتصال بالباك إند.
const AdminConfig = {
  apiBase: "/xampp/php-project/backend/api/",
  timeout: 120000,
  csrfStorageKey: "eco-marc-admin-csrf"
};

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');

  if (meta && meta.content.trim() !== "") {
    return meta.content.trim();
  }

  const savedToken = sessionStorage.getItem(AdminConfig.csrfStorageKey);
  if (savedToken) {
    return savedToken;
  }

  return "";
}

// كل طلبات الصفحات تمر من هذه الدالة.
async function sendRequest(endpoint, options = {}) {
  let method = "GET";
  if (options.method) {
    method = options.method;
  }

  const headers = { Accept: "application/json" };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

// TEMPORARY: CSRF paused for local testing. Restore before deployment.
//   if (method !== "GET") {
//     const token = getCsrfToken();
//     if (token === "") {
//       throw new Error("Your session could not be verified. Sign in again, then retry.");
//     }
//     headers["X-CSRF-Token"] = token;
//   }

  const controller = new AbortController();

  function cancelRequest() {
    controller.abort();
  }

  // زر الإلغاء في صفحة المساعد يستخدم نفس الطلب.
  if (options.signal) {
    options.signal.addEventListener("abort", cancelRequest, { once: true });
    if (options.signal.aborted) {
      cancelRequest();
    }
  }

  const timer = setTimeout(cancelRequest, AdminConfig.timeout);
  const settings = {
    method: method,
    headers: headers,
    credentials: "same-origin",
    cache: "no-store",
    signal: controller.signal
  };

  if (options.body !== undefined) {
    settings.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(AdminConfig.apiBase + endpoint, settings);
    // رد المساعد يصل على أجزاء، أما باقي الطلبات فترجع JSON عادي.
    if (options.onEvent && response.ok && (response.headers.get("Content-Type") || "").includes("application/x-ndjson")) {
      return await readAssistantStream(response, options.onEvent);
    }

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (error) {
      throw new Error("The server returned an unexpected response. Please try again.");
    }

    if (!response.ok || result.success !== true) {
      let message = "Request failed (" + response.status + ").";

      if (result.message) {
        message = result.message;
      }
      if (response.status === 401) {
        message = "Please sign in with your admin account, then retry.";
      }

      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      if (options.signal && options.signal.aborted) {
        throw error;
      }
      throw new Error("The request took too long. Please try again.");
    }

    if (error instanceof TypeError) {
      throw new Error("Cannot connect to the store. Please check your connection and try again.");
    }

    throw error;
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener("abort", cancelRequest);
    }
  }
}

async function getInsights(from, to) {
  let endpoint = "admin-ai.php";
  if (from && to) {
    endpoint += "?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
  }
  const result = await sendRequest(endpoint);
  if (!result.data || typeof result.data !== "object") {
    throw new Error("The analytics response is missing data.");
  }
  return result.data;
}

async function sendAIMessage(message, signal) {
  const result = await sendRequest("admin-ai.php", {
    method: "POST",
    body: { message: message },
    signal: signal
  });

  if (typeof result.answer !== "string" || result.answer.trim() === "") {
    throw new Error("The AI endpoint returned no answer.");
  }
  return result.answer;
}

async function getReviews() {
  const result = await sendRequest("reviews.php");
  if (!Array.isArray(result.data)) {
    throw new Error("The reviews response must contain a data array.");
  }
  return result.data;
}

async function getReviewStatistics() {
  const result = await sendRequest("reviews.php?stats=1");
  return result.data;
}

async function updateReviewStatus(id, status) {
  return sendRequest("reviews.php", {
    method: "PATCH",
    body: { id: Number(id), status: status }
  });
}

async function deleteReview(id) {
  return sendRequest("reviews.php?id=" + encodeURIComponent(id), {
    method: "DELETE"
  });
}

// أسماء الخدمات التي تستعملها الصفحات.
const AdminAPI = {
  token: getCsrfToken,
  request: sendRequest,
  insights: getInsights,
  ask: sendAIMessage,
  askDetails: sendDetailedAIMessage,
  reviews: getReviews,
  reviewStats: getReviewStatistics,
  setReviewStatus: updateReviewStatus,
  deleteReview: deleteReview
};

// قراءة سطور JSON مع الحفاظ على الحروف العربية بين الأجزاء.
async function readAssistantStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = null;

  function readLine(line) {
    if (line.trim() === "") return;
    const event = JSON.parse(line);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "done") finalResult = event.data;
    onEvent(event);
  }

  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      buffer += decoder.decode(part.value, { stream: true });
      let endOfLine = buffer.indexOf("\n");
      while (endOfLine !== -1) {
        readLine(buffer.slice(0, endOfLine));
        buffer = buffer.slice(endOfLine + 1);
        endOfLine = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    readLine(buffer);
    if (!finalResult || typeof finalResult.answer !== "string") {
      throw new Error("The answer was interrupted. Please retry.");
    }
    return finalResult;
  } finally {
    reader.releaseLock();
  }
}

async function sendDetailedAIMessage(message, history, period, signal, onEvent) {
  return sendRequest("admin-ai.php", {
    method: "POST",
    body: {
      message: message,
      history: history,
      from: period.from,
      to: period.to,
      stream: true
    },
    signal: signal,
    onEvent: onEvent
  });
}
