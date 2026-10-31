<?php

header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store");

require_once __DIR__ . "/../classes/Products.php";

require_once __DIR__ . "/../middleware/admin.php";
require_once __DIR__ . "/../middleware/csrf.php";

require_once __DIR__ . "/../classes/CloudinaryImages.php";
$imageStorage = null;
$uploadedImages = [];
$products = null;

function releaseNewProductImages($products, $storage, array $images): void {
    if (!($products instanceof Product) || !($storage instanceof CloudinaryImages)) return;
    $publicIds = array_column($images, 'public_id');
    $storage->cleanup($products, $publicIds);
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        requireAdmin();

        requireCsrf();
    }
    $products = new Product();

    $method = $_SERVER["REQUEST_METHOD"];

    $id = isset($_GET["id"]) ? (int) $_GET["id"] : 0;

     
    if ($method === "GET") {
        $adminCatalog = ($_GET["admin"] ?? "") === "1";
        if ($adminCatalog) requireAdmin();
        $gender = Product::validateGender($_GET["gender"] ?? null);

        if (isset($_GET["category_id"])) {
            $categoryId = (int) $_GET["category_id"];

            if (
                $categoryId <= 0 ||
                !$products->categoryExists($categoryId)
            ) {
                http_response_code(400);
                echo json_encode(["message" => "Invalid category"]);
                exit;
            }

            echo json_encode(
                array_values(array_filter($products->getProductsByCategory($categoryId, $adminCatalog), static fn($product) => $gender === null || $product["gender"] === $gender || $product["gender"] === "unisex"))
            );
            exit;
        }

        if ($id > 0) {
            $product = $products->getProduct($id, $adminCatalog);

            if (!$product) {
                http_response_code(404);
                echo json_encode(["message" => "Product not found"]);
                exit;
            }

            echo json_encode($product);
            exit;
        }

        echo json_encode($products->getProducts($gender, $adminCatalog));
        exit;
    }

     
    if ($method === "POST") {

        $id = isset($_POST["id"]) ? (int) $_POST["id"] : 0;

        $name = trim($_POST["name"] ?? "");
        $description = trim($_POST["description"] ?? "");
        $price = $_POST["price"] ?? "";
        $quantity = $_POST["quantity"] ?? "";
        $categoryId = (int) ($_POST["category_id"] ?? 0);
        $discountId = $_POST["discount_id"] ?? "";
        $gender = Product::validateGender(array_key_exists("gender",$_POST) ? $_POST["gender"] : ($id > 0 ? ($products->getProduct($id)["gender"] ?? null) : null));

        $isActive = isset($_POST["is_active"])
            ? (int) $_POST["is_active"]
            : 1;

         
        if (
            $name === "" ||
            $price === "" ||
            !is_numeric($price) ||
            (float) $price < 0 ||
            filter_var($quantity, FILTER_VALIDATE_INT) === false ||
            (int) $quantity < 0 ||
            $categoryId <= 0
        ) {
            http_response_code(400);

            echo json_encode([
                "message" => "Enter a valid name, price, quantity and category"
            ]);

            exit;
        }

        if (!$products->categoryExists($categoryId)) {
            http_response_code(400);
            echo json_encode(["message" => "Category not found"]);
            exit;
        }

         
        if ($discountId === "") {
            $discountId = null;
        } else {
            $discountId = (int) $discountId;

            if (!$products->discountExists($discountId)) {
                http_response_code(400);
                echo json_encode(["message" => "Discount not found"]);
                exit;
            }
        }

         
        if (!in_array($isActive, [0, 1], true)) {
            http_response_code(400);
            echo json_encode(["message" => "Invalid product status"]);
            exit;
        }

         
        if ($id > 0 && !$products->productExists($id)) {
            http_response_code(404);
            echo json_encode(["message" => "Product not found"]);
            exit;
        }

         
        $variants = json_decode($_POST["variants"] ?? "[]", true);

        if (!is_array($variants) || count($variants) === 0) {
            http_response_code(400);

            echo json_encode([
                "message" => "Add at least one product variant"
            ]);

            exit;
        }

        $allowedSizes = [
            "XS", "S", "M", "L", "XL", "XXL",
            "36", "37", "38", "39", "40", "41",
            "42", "43", "44", "45", "46", "ONE_SIZE"
        ];

        $allowedColors = [
            "black", "white", "gray", "red", "blue",
            "navy", "green", "yellow", "orange", "pink",
            "purple", "brown", "beige", "other"
        ];

        $cleanVariants = [];
        $usedVariants = [];
        $totalVariantQuantity = 0;

        foreach ($variants as $variant) {
            $size = trim((string) ($variant["size"] ?? ""));
            $color = strtolower(trim((string) ($variant["color"] ?? "")));
            $variantQuantity = $variant["quantity"] ?? "";

            if (
                !in_array($size, $allowedSizes, true) ||
                !in_array($color, $allowedColors, true) ||
                filter_var(
                    $variantQuantity,
                    FILTER_VALIDATE_INT
                ) === false ||
                (int) $variantQuantity < 0
            ) {
                http_response_code(400);

                echo json_encode([
                    "message" => "Check variant size, color and quantity"
                ]);

                exit;
            }

            $variantKey = $size . "_" . $color;

            if (isset($usedVariants[$variantKey])) {
                http_response_code(400);

                echo json_encode([
                    "message" => "The same size and color cannot be repeated"
                ]);

                exit;
            }

            $usedVariants[$variantKey] = true;

            $variantQuantity = (int) $variantQuantity;
            $totalVariantQuantity += $variantQuantity;

            $cleanVariants[] = [
                "size" => $size,
                "color" => $color,
                "quantity" => $variantQuantity
            ];
        }

         
        $productQuantity = (int) $quantity;

        if ($totalVariantQuantity !== $productQuantity) {
            http_response_code(400);

            echo json_encode([
                "message" => "Product quantity is " .
                    $productQuantity .
                    ", but variants total is " .
                    $totalVariantQuantity .
                    ". The quantities must match."
            ]);

            exit;
        }

        $keepImages = null;
        if ($id > 0 && isset($_POST["existing_images"])) {
            $keepImages = json_decode($_POST["existing_images"], true);
            if (!is_array($keepImages) || count($keepImages) > 100) {
                throw new InvalidArgumentException("Send a valid list of existing product images.");
            }
            $storedImages = array_column($products->getProduct($id)["images"], "image_url");
            foreach ($keepImages as $image) {
                if (!is_string($image) || !in_array($image, $storedImages, true)) {
                    throw new InvalidArgumentException("One of the images does not belong to this product.");
                }
            }
        }

         
        $imagePaths = [];
        $imageFiles = [];
        if (isset($_FILES['images'])) {
            $files = $_FILES['images'];
            if (!is_array($files['name'] ?? null) || count($files['name']) > 5) {
                throw new InvalidArgumentException('Upload up to 5 images at a time.');
            }
            for ($i = 0; $i < count($files['name']); $i++) {
                $error = $files['error'][$i] ?? UPLOAD_ERR_NO_FILE;
                if ($error === UPLOAD_ERR_NO_FILE) continue;
                if ($error !== UPLOAD_ERR_OK) throw new InvalidArgumentException('An image could not be uploaded.');
                $temporaryFile = $files['tmp_name'][$i] ?? '';
                if (!is_string($temporaryFile) || !is_uploaded_file($temporaryFile)) throw new InvalidArgumentException('Invalid image upload.');
                if (filesize($temporaryFile) > 5 * 1024 * 1024) throw new InvalidArgumentException('Each image must be 5MB or less.');
                $info = @getimagesize($temporaryFile);
                if (!$info || !in_array($info['mime'], ['image/jpeg','image/png','image/webp','image/gif'], true)) {
                    throw new InvalidArgumentException('Only valid JPG, PNG, WEBP and GIF images are allowed.');
                }
                $imageFiles[] = $temporaryFile;
            }
        }
        if ($id === 0 && !$imageFiles) throw new InvalidArgumentException('Upload at least one product image.');
        if ($imageFiles) {
            $imageStorage = new CloudinaryImages();
            foreach ($imageFiles as $temporaryFile) {
                $image = $imageStorage->upload($temporaryFile);
                $uploadedImages[] = $image;
                $imagePaths[] = $image;
            }
        }

         
        $data = [
            "name" => $name,
            "description" => $description,
            "price" => (float) $price,
            "quantity" => $productQuantity,
            "category_id" => $categoryId,
            "gender" => $gender,
            "discount_id" => $discountId,
            "is_active" => $isActive
        ];

         
        if ($id > 0) {
            $products->updateProduct(
                $id,
                $data,
                $imagePaths,
                $cleanVariants,
                $keepImages
            );


             
            $uploadedImages = [];
            try { (new CloudinaryImages())->cleanup($products, $products->removedImageIds()); }
            catch (Throwable $error) { error_log('Lumeire: Cloudinary image deletion could not finish.'); }

            echo json_encode([
                "message" => "Product updated successfully",
                "id" => $id
            ]);

            exit;
        }

         
        $newId = $products->createProduct(
            $data,
            $imagePaths,
            $cleanVariants
        );


             
            $uploadedImages = [];
            try { (new CloudinaryImages())->cleanup($products, $products->removedImageIds()); }
            catch (Throwable $error) { error_log('Lumeire: Cloudinary image deletion could not finish.'); }

        http_response_code(201);

        echo json_encode([
            "message" => "Product created successfully",
            "id" => $newId
        ]);

        exit;
    }

     
    if ($method === "DELETE") {

        if ($id <= 0 || !$products->productExists($id)) {
            http_response_code(404);
            echo json_encode(["message" => "Product not found"]);
            exit;
        }

        $products->deleteProduct($id);

        echo json_encode([
            "message" => "Product deleted successfully"
        ]);

        exit;
    }

    http_response_code(405);

    echo json_encode([
        "message" => "Method not allowed"
    ]);

} catch (CloudinaryUploadException $e) {
    if ($e->publicId !== '') $uploadedImages[] = ['public_id' => $e->publicId];
    releaseNewProductImages($products, $imageStorage, $uploadedImages);
    http_response_code(502);
    echo json_encode(['message' => $e->getMessage()]);
} catch (DomainException $e) {
    releaseNewProductImages($products, $imageStorage, $uploadedImages);
    http_response_code(409);
    echo json_encode(['message' => $e->getMessage()]);
} catch (InvalidArgumentException $e) {
    releaseNewProductImages($products, $imageStorage, $uploadedImages);
    http_response_code(400);
    echo json_encode(['message' => $e->getMessage()]);
} catch (Throwable $e) {
    releaseNewProductImages($products, $imageStorage, $uploadedImages);
    http_response_code(500);
    echo json_encode(['message' => 'Could not save the product. Please try again.']);
}
