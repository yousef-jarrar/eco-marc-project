<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../classes/Category.php';
require_once __DIR__ . '/../classes/CloudinaryImages.php';
require_once __DIR__ . '/../middleware/admin.php';
require_once __DIR__ . '/../middleware/csrf.php';

function respondCategory(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function cleanCategoryImages(Product $products, CloudinaryImages $storage, array $publicIds): void
{
    try {
        $storage->cleanup($products, $publicIds);
    } catch (Throwable $error) {
        error_log('Eco Marc: category image cleanup could not finish.');
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'DELETE') {
    header('Allow: GET, POST, PUT');
    respondCategory(405, [
        'success' => false,
        'message' => 'Use the category status to deactivate a category. Deletion is not supported.'
    ]);
}
if (!in_array($method, ['GET', 'POST', 'PUT'], true)) {
    header('Allow: GET, POST, PUT');
    respondCategory(405, ['success' => false, 'message' => 'Method not allowed.']);
}

try {
    if ($method !== 'GET') {
        requireAdmin();
        requireCsrf();
    }

    $connection = (new Database())->connect();
    $category = new Category($connection);

    if ($method === 'GET') {
        $adminCatalog = ($_GET['admin'] ?? '') === '1';
        if ($adminCatalog) requireAdmin();
        if (isset($_GET['id'])) {
            $id = filter_var($_GET['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($id === false) {
                throw new InvalidArgumentException('Invalid category ID.');
            }

            $visibleCategory = $category->getCategoriesById($id);
            if (!$adminCatalog && (!$visibleCategory || $visibleCategory['status'] !== 'active')) {
                respondCategory(404, ['success' => false, 'message' => 'Category not found.']);
            }
            if (($_GET['action'] ?? '') === 'products') {
                echo json_encode($adminCatalog ? $category->allcategoriesProducts($id) : (new Product($connection))->getProductsByCategory($id, false), JSON_UNESCAPED_UNICODE);
                exit;
            }

            $result = $category->getCategoriesById($id);
            if ($result === false) {
                respondCategory(404, ['success' => false, 'message' => 'Category not found.']);
            }
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            exit;
        }

        echo json_encode($category->getAllCategories($adminCatalog), JSON_UNESCAPED_UNICODE);
        exit;
    }

    $multipart = stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0;
    $data = $multipart ? $_POST : json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        throw new InvalidArgumentException('Send valid category data.');
    }

    $editing = $method === 'PUT' || ($method === 'POST' && ($data['action'] ?? '') === 'update');
    $id = null;
    $old = null;
    if ($editing) {
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            throw new InvalidArgumentException('Invalid category ID.');
        }
        $old = $category->getCategoriesById($id);
        if ($old === false) {
            respondCategory(404, ['success' => false, 'message' => 'Category not found.']);
        }
    }

    if (!is_string($data['name'] ?? null) || trim($data['name']) === '' || mb_strlen(trim($data['name'])) > 100) {
        throw new InvalidArgumentException('Enter a category name of 1–100 characters.');
    }
    $name = trim($data['name']);
    $status = $data['status'] ?? ($old['status'] ?? 'active');
    if (!in_array($status, ['active', 'inactive'], true)) {
        throw new InvalidArgumentException('Invalid category status.');
    }
    $imageUrl = $data['image_url'] ?? ($old['image_url'] ?? '');
    if (!is_string($imageUrl)) {
        throw new InvalidArgumentException('Invalid image URL.');
    }
    $imageUrl = trim($imageUrl);
    $removeImage = in_array($data['remove_image'] ?? false, [true, 1, '1'], true);
    if ($removeImage) {
        $imageUrl = '';
    }
    if (
        $imageUrl !== '' &&
        (strlen($imageUrl) > 500 ||
            !filter_var($imageUrl, FILTER_VALIDATE_URL) ||
            !in_array(parse_url($imageUrl, PHP_URL_SCHEME), ['http', 'https'], true))
    ) {
        throw new InvalidArgumentException('Use a valid HTTP or HTTPS image URL.');
    }

    $storage = new CloudinaryImages();
    $products = new Product($connection);
    $newImage = null;
    $publicId = $old && $imageUrl === $old['image_url'] ? ($old['public_id'] ?? null) : null;

    try {
        if (isset($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            if ($removeImage) {
                throw new InvalidArgumentException('Choose an image or remove the current image, not both.');
            }
            $file = $_FILES['image'];
            $temporary = $file['tmp_name'] ?? '';
            if (($file['error'] ?? -1) !== UPLOAD_ERR_OK || !is_string($temporary) || !is_uploaded_file($temporary)) {
                throw new InvalidArgumentException('The image could not be uploaded.');
            }
            if (filesize($temporary) > 5 * 1024 * 1024) {
                throw new InvalidArgumentException('The image must be 5MB or less.');
            }
            $info = @getimagesize($temporary);
            if (!$info || !in_array($info['mime'], ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
                throw new InvalidArgumentException('Use a valid JPG, PNG, WEBP or GIF image.');
            }
            $newImage = $storage->upload($temporary, 'categories');
            $imageUrl = $newImage['image_url'];
            $publicId = $newImage['public_id'];
        }

        if ($editing) {
            $category->updateCategories($id, $name, $imageUrl ?: null, $publicId, $status);
        } else {
            $category->creatCategories($name, $imageUrl ?: null, $publicId, $status);
        }

        $newImage = null;
        cleanCategoryImages($products, $storage, $category->removedImageIds());
        respondCategory(200, ['success' => true, 'message' => 'Category saved successfully.']);
    } catch (Throwable $error) {
        if ($error instanceof CloudinaryUploadException) {
            $newImage = ['public_id' => $error->publicId];
        }
        if ($newImage) {
            cleanCategoryImages($products, $storage, [$newImage['public_id']]);
        }
        throw $error;
    }
} catch (Throwable $error) {
    $status = 500;
    $message = 'The category could not be saved. Please try again.';
    if ($error instanceof InvalidArgumentException) {
        $status = 400;
        $message = $error->getMessage();
    } elseif ($error instanceof CloudinaryUploadException) {
        $status = 502;
        $message = $error->getMessage();
    } elseif ($error instanceof DomainException) {
        $status = 409;
        $message = $error->getMessage();
    } elseif ($error instanceof PDOException && (string)$error->getCode() === '23000') {
        $status = 409;
        $message = 'This category name is already used.';
    } elseif ($error->getCode() === 404) {
        $status = 404;
        $message = 'Category not found.';
    }
    if ($status === 500) {
        error_log('Eco Marc categories: ' . $error->getMessage());
    }
    respondCategory($status, ['success' => false, 'message' => $message]);
}
