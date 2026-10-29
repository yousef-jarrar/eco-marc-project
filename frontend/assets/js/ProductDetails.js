const API_PRODUCTS = AdminConfig.apiBase + "Products.php";
const IMAGE_BASE = "../../";

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char];
    });
}

function getImageUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return IMAGE_BASE + path.replace(/^\/+/, "");
}

async function loadProductDetails() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const message = document.getElementById("message");

    if (!id || !/^\d+$/.test(id) || Number(id) <= 0) {
        message.textContent = "Invalid product ID.";
        Alerts.show("Product not found", "Open a product from the products page.", "warning");
        message.className = "error-banner";
        return;
    }

    try {
        const response = await EcoAuth.fetch(`${API_PRODUCTS}?id=${encodeURIComponent(id)}`);
        const product = await response.json();

        if (!response.ok || !product || !product.id) {
            throw new Error(product.message || "Product could not be found.");
        }

        document.getElementById("detailsContent").style.display = "block";
        message.style.display = "none";

        document.getElementById("productId").textContent = "Product ID: " + product.id;
        document.getElementById("productName").textContent = product.name || "";
        document.getElementById("productPrice").textContent =
            "JOD " + Number(product.price || 0).toFixed(2);
        document.getElementById("categoryName").textContent = product.category_name || "—";
        document.getElementById("productQuantity").textContent = Number(product.quantity || 0);
        document.getElementById("discountName").textContent = product.discount_name || "No discount";

        const status = document.getElementById("productStatus");
        if (product.is_active === undefined) {
            status.textContent = "—";
        } else if (Number(product.is_active) === 1) {
            status.className = "status approved";
            status.textContent = "Active";
        } else {
            status.className = "status inactive";
            status.textContent = "Inactive";
        }

        const percentage = product.discount_percentage;
        document.getElementById("discountPercentage").textContent =
            percentage === null || percentage === undefined || percentage === ""
                ? "—"
                : Number(percentage) + "%";

        document.getElementById("productDescription").textContent =
            product.description || "No description provided.";

        const images = Array.isArray(product.images) ? product.images : [];
        const mainImage = document.getElementById("mainImage");
        const gallery = document.getElementById("gallery");

        if (images.length > 0) {
            mainImage.src = getImageUrl(images[0].image_url);

            images.forEach((image, index) => {
                const thumbnail = document.createElement("img");
                thumbnail.src = getImageUrl(image.image_url);
                thumbnail.alt = "Product image " + (index + 1);

                if (index === 0) thumbnail.classList.add("selected");

                thumbnail.addEventListener("click", () => {
                    mainImage.src = thumbnail.src;
                    gallery.querySelectorAll("img").forEach(img => img.classList.remove("selected"));
                    thumbnail.classList.add("selected");
                });

                gallery.appendChild(thumbnail);
            });
        } else {
            mainImage.style.display = "none";
            gallery.textContent = "No product images.";
        }

        const variants = Array.isArray(product.variants) ? product.variants : [];
        const variantsTable = document.getElementById("variantsTable");

        if (variants.length === 0) {
            variantsTable.innerHTML = '<tr><td colspan="3">No variants found.</td></tr>';
        } else {
            variantsTable.innerHTML = variants.map(variant => `
                <tr>
                    <td>${escapeHtml(variant.size)}</td>
                    <td>${escapeHtml(variant.color)}</td>
                    <td>${Number(variant.quantity || 0)}</td>
                </tr>
            `).join("");
        }
    } catch (error) {
        message.textContent = error.message;
        Alerts.show("Product could not load", error.message, "error");
        message.className = "error-banner";
    }
}

loadProductDetails();
