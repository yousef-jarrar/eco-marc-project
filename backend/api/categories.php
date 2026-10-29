<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../classes/Category.php';
require_once __DIR__ . '/../classes/CloudinaryImages.php';
require_once __DIR__ . '/../middleware/admin.php';
require_once __DIR__ . '/../middleware/csrf.php';

$newImage = null;
$products = null;
$storage = new CloudinaryImages();
function cleanCategoryImages($products, $storage, array $publicIds): void {
    if (!$products) return;
    try { $storage->cleanup($products, $publicIds); }
    catch (Throwable $error) { error_log('Eco Marc: category image deletion could not finish.'); }
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method !== 'GET') { requireAdmin(); requireCsrf(); }
    $connection = (new Database())->connect();
    $category = new Category($connection);
    $products = new Product($connection);
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            $id = filter_var($_GET['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if (!$id) throw new InvalidArgumentException('Invalid category ID.');
            $result = ($_GET['action'] ?? '') === 'products' ? $category->allcategoriesProducts($id) : $category->getCategoriesById($id);
            if ($result === false) throw new RuntimeException('Category not found.', 404);
        } else $result = $category->getAllCategories();
        echo json_encode($result); exit;
    }
    if (!in_array($method, ['POST','PUT','DELETE'], true)) {
        http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit;
    }
    $multipart = stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0;
    $data = $multipart ? $_POST : json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) throw new InvalidArgumentException('Send valid category data.');
    $editing = $method === 'PUT' || ($method === 'POST' && ($data['action'] ?? '') === 'update');
    $id = null; $old = null;
    if ($editing || $method === 'DELETE') {
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
        if (!$id) throw new InvalidArgumentException('Invalid category ID.');
        $old = $category->getCategoriesById($id);
        if (!$old) throw new RuntimeException('Category not found.', 404);
    }
    if ($method === 'DELETE') {
        $category->deleteCategories($id);
        cleanCategoryImages($products, $storage, $category->removedImageIds());
        echo json_encode(['seccses'=>true,'massage'=>'Category deleted successfully']); exit;
    }
    if (!is_string($data['name'] ?? null) || trim($data['name']) === '' || mb_strlen(trim($data['name'])) > 100) {
        throw new InvalidArgumentException('Enter a category name of 1–100 characters.');
    }
    $name = trim($data['name']);
    $imageUrl = $data['image_url'] ?? ($old['image_url'] ?? '');
    if (!is_string($imageUrl)) throw new InvalidArgumentException('Invalid image URL.');
    $imageUrl = trim($imageUrl);
    $remove = in_array($data['remove_image'] ?? false, [true, 1, '1'], true);
    if ($remove) $imageUrl = '';
    if ($imageUrl !== '' && (strlen($imageUrl)>500 || !filter_var($imageUrl,FILTER_VALIDATE_URL) || !in_array(parse_url($imageUrl,PHP_URL_SCHEME),['http','https'],true))) {
        throw new InvalidArgumentException('Use a valid HTTP or HTTPS image URL.');
    }
    $publicId = $old && $imageUrl === $old['image_url'] ? $old['public_id'] : null;
    if (isset($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        if ($remove) throw new InvalidArgumentException('Choose an image or remove the current image, not both.');
        $file = $_FILES['image'];
        $temporary = $file['tmp_name'] ?? '';
        if (($file['error'] ?? -1) !== UPLOAD_ERR_OK || !is_string($temporary) || !is_uploaded_file($temporary)) throw new InvalidArgumentException('The image could not be uploaded.');
        if (filesize($temporary)>5*1024*1024) throw new InvalidArgumentException('The image must be 5MB or less.');
        $info = @getimagesize($temporary);
        if (!$info || !in_array($info['mime'],['image/jpeg','image/png','image/webp','image/gif'],true)) throw new InvalidArgumentException('Use a valid JPG, PNG, WEBP or GIF image.');
        $newImage = $storage->upload($temporary, 'categories');
        $imageUrl = $newImage['image_url']; $publicId = $newImage['public_id'];
    }
    if ($editing) $category->updateCategories($id,$name,$imageUrl ?: null,$publicId);
    else $category->creatCategories($name,$imageUrl ?: null,$publicId);
    $newImage = null;
    cleanCategoryImages($products,$storage,$category->removedImageIds());
    echo json_encode(['seccses'=>true,'massage'=>'Category saved successfully']);
} catch (Throwable $error) {
    if ($error instanceof CloudinaryUploadException) $newImage = ['public_id'=>$error->publicId];
    if ($newImage && $products) {
        cleanCategoryImages($products, $storage, [$newImage['public_id']]);
    }
    $status = 500; $message = 'The category could not be saved. Please try again.';
    if ($error instanceof CloudinaryUploadException) { $status=502; $message=$error->getMessage(); }
    elseif ($error instanceof DomainException) { $status=409; $message=$error->getMessage(); }
    elseif ($error instanceof InvalidArgumentException) { $status=400; $message=$error->getMessage(); }
    elseif ($error instanceof PDOException && (string)$error->getCode()==='23000') { $status=409; $message='This category name is already used, or products still reference this category.'; }
    elseif ($error->getCode()===404) { $status=404; $message='Category not found.'; }
    http_response_code($status); echo json_encode(['success'=>false,'message'=>$message]);
}
