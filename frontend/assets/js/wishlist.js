const WISHLIST_API = "/eco-marc-project/backend/api/wishlist.php";

const wishlistGrid = document.getElementById("wishlistGrid");
const wishlistCount = document.getElementById("wishlistCount");
const wishlistMessage = document.getElementById("wishlistMessage");

function getImageUrl(path) {
    if (!path) return "";

    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }

    return new URL("../" + path.replace(/^\/+/, ""), location.href).href;
}

function showEmptyWishlist() {
    wishlistGrid.innerHTML = `
        <div class="wishlist-empty">
            <h3>Your wishlist is empty</h3>
            <p>Save the pieces you love and find them here.</p>
            <a href="/eco-marc-project/frontend/Shop.html">Explore Collection</a>
        </div>
    `;
}

function renderWishlist(products) {
    wishlistGrid.innerHTML = "";
    wishlistCount.textContent = `${products.length} items`;

    if (products.length === 0) {
        showEmptyWishlist();
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "wishlist-card";

        const imageContainer = document.createElement("div");
        imageContainer.className = "wishlist-image";

        const image = document.createElement("img");
        image.src = getImageUrl(product.image_url);
        image.alt = product.name;

        const badge = document.createElement("span");
        badge.className = "wishlist-badge";
        badge.textContent = "New season";

        const heart = document.createElement("button");
        heart.className = "wishlist-heart";
        heart.type = "button";
        heart.innerHTML = '<i class="fa-solid fa-heart"></i>';

        heart.setAttribute(
            "aria-label",
            `Remove ${product.name} from wishlist`
        );

        heart.addEventListener("click", () => {
            removeFromWishlist(product.id, heart);
        });

        imageContainer.append(image, badge, heart);

        const info = document.createElement("div");
        info.className = "wishlist-info";

        const name = document.createElement("h3");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.className = "wishlist-price";
        price.textContent = `JOD ${Number(product.price).toFixed(2)}`;

        info.append(name, price);

        const colors = [
            ...new Set(
                (product.variants || [])
                    .map(variant => variant.color)
                    .filter(Boolean)
            )
        ];

        if (colors.length > 0) {
            const colorsContainer = document.createElement("div");
            colorsContainer.className = "wishlist-colors";

            colors.forEach(color => {
                const colorCircle = document.createElement("span");
                colorCircle.className = "wishlist-color";
                colorCircle.title = color;

                if (CSS.supports("color", color)) {
                    colorCircle.style.backgroundColor = color;
                }

                colorsContainer.appendChild(colorCircle);
            });

            info.appendChild(colorsContainer);
        }

        card.append(imageContainer, info);
        wishlistGrid.appendChild(card);
    });
}

async function loadWishlist() {
    wishlistMessage.textContent = "Loading wishlist...";
    wishlistGrid.innerHTML = "";

    try {
        const response = await fetch(WISHLIST_API, {
            method: "GET",
            credentials: "same-origin"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to load wishlist."
            );
        }

        renderWishlist(result.data);
        wishlistMessage.textContent = "";

    } catch (error) {
        console.error(error);
        wishlistMessage.textContent = error.message;
        wishlistCount.textContent = "0 items";
    }
}

async function removeFromWishlist(productId, button) {
    button.disabled = true;

    try {
        const response = await fetch(WISHLIST_API, {
            method: "DELETE",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                product_id: productId
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to remove product."
            );
        }

        await loadWishlist();

    } catch (error) {
        console.error(error);
        wishlistMessage.textContent = error.message;
        button.disabled = false;
    }
}

loadWishlist();