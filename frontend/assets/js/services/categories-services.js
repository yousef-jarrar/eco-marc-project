const API_URL = "http://localhost/eco-marc-project/backend/api/categories.php";
async function categoryRequest(method, data = null, query = "") {
    const options = {
        method: method,
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    };

    if (data !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
    }

    const response = await fetch(API_URL + query, options);
   
    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new Error("The server returned an unexpected response. Please retry.");
    }

    if (!response.ok || result.seccses === false || result.seccess === false || result.success === false) {
        throw new Error(result.message || result.massage || "Category request failed.");
    }
    return result;
}

export async function getAllCategories() {
    const categories = await categoryRequest("GET");
    if (!Array.isArray(categories)) throw new Error("The category list could not be loaded.");
    return categories;
}

export async function getCategoryById(id) {
    return categoryRequest("GET", null, "?id=" + encodeURIComponent(id));
}

export async function getCategoryProducts(id) {
    return categoryRequest("GET", null, "?id=" + encodeURIComponent(id) + "&action=products");
}

export async function createCategory(name, image_url,status) {
    return categoryRequest("POST", { name: name, image_url: image_url, status: status });
}

export async function updateCategory(id, name, image_url,status) {
    return categoryRequest("PUT", { id: Number(id), name: name, image_url: image_url, status: status });
}

export async function deleteCategory(id) {
    return categoryRequest("DELETE", { id: Number(id) });
}
