<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../classes/Discounts.php";
function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function readInput(): array
{
    $data = json_decode(file_get_contents("php://input"), true);

    if (!is_array($data)) {
        respond(400, [
            "success" => false,
            "message" => "Request body must be valid JSON"
        ]);
    }

    return $data;
}

function validateDateTime($value, string $field): ?string
{
    if ($value === null) {
        return null;
    }

    if (!is_string($value)) {
        respond(422, [
            "success" => false,
            "message" => "$field must be a datetime string or null"
        ]);
    }

    $date = DateTime::createFromFormat('!Y-m-d H:i:s', $value);
    $errors = DateTime::getLastErrors();

    if (
        !$date ||
        $date->format('Y-m-d H:i:s') !== $value ||
        ($errors !== false &&
            ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
    ) {
        respond(422, [
            "success" => false,
            "message" => "$field must use YYYY-MM-DD HH:MM:SS format"
        ]);
    }

    return $value;
}

function validateNewDiscount(array $data): array
{
    foreach (['name', 'type'] as $field) {
        if (!isset($data[$field]) || !is_string($data[$field])) {
            respond(422, [
                "success" => false,
                "message" => "$field is required and must be a string"
            ]);
        }
    }

    if (
        !isset($data['percentage']) ||
        !is_numeric($data['percentage'])
    ) {
        respond(422, [
            "success" => false,
            "message" => "Percentage is required and must be numeric"
        ]);
    }

    $name = trim($data['name']);
    $type = $data['type'];
    $percentage = (float) $data['percentage'];

    if ($name === '' || strlen($name) > 100) {
        respond(422, [
            "success" => false,
            "message" => "Name is required and cannot exceed 100 characters"
        ]);
    }

    if (!in_array($type, ['normal', 'coupon'], true)) {
        respond(422, [
            "success" => false,
            "message" => "Type must be normal or coupon"
        ]);
    }

    if ($percentage < 0 || $percentage > 100) {
        respond(422, [
            "success" => false,
            "message" => "Percentage must be between 0 and 100"
        ]);
    }

    $startDate = validateDateTime(
        $data['start_date'] ?? null,
        'start_date'
    );

    $endDate = validateDateTime(
        $data['end_date'] ?? null,
        'end_date'
    );

    if (
        $startDate !== null &&
        $endDate !== null &&
        $startDate > $endDate
    ) {
        respond(422, [
            "success" => false,
            "message" => "End date must be after start date"
        ]);
    }

    return [
        'name' => $name,
        'type' => $type,
        'percentage' => $percentage,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'product_ids' => $data['product_ids'] ?? [],
        'coupon_code' => $data['coupon_code'] ?? null
    ];
}

try {
    require_once __DIR__ . "/../middleware/admin.php";
    require_once __DIR__ . "/../middleware/csrf.php";
    requireAdmin();
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method !== "GET") requireCsrf();
    $discounts = new Discounts();

    // Validate optional ID
    $id = null;

    if (isset($_GET['id'])) {
        $id = filter_var(
            $_GET['id'],
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if ($id === false) {
            respond(400, [
                "success" => false,
                "message" => "Invalid discount ID"
            ]);
        }
    }

    switch ($method) {
        // GET: list discounts or get one discount
        case 'GET':

            if ($id !== null) {
                $result = $discounts->getById($id);

                if ($result === false) {
                    respond(404, [
                        "success" => false,
                        "message" => "Active discount not found"
                    ]);
                }

                respond(200, [
                    "success" => true,
                    "data" => $result
                ]);
            }

            $page = filter_var(
                $_GET['page'] ?? 1,
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );

            if ($page === false) {
                respond(400, [
                    "success" => false,
                    "message" => "Page must be a positive integer"
                ]);
            }

            $name = $_GET['name'] ?? null;

            if ($name !== null && !is_string($name)) {
                respond(400, [
                    "success" => false,
                    "message" => "Name filter must be a string"
                ]);
            }

            $startDate = validateDateTime(
                $_GET['start_date'] ?? null,
                'start_date'
            );

            $endDate = validateDateTime(
                $_GET['end_date'] ?? null,
                'end_date'
            );

            respond(200, array_merge(["success" => true], $discounts->getDiscounts(
                    $page,
                    $name,
                    $startDate,
                    $endDate,
                    ($_GET['include_inactive'] ?? '0') === '1'
                )));

        // POST: create discount
        case 'POST':

            $data = validateNewDiscount(readInput());

            if (isset($data['product_ids']) && !is_array($data['product_ids'])) throw new InvalidArgumentException('Choose valid products.');
            if (isset($data['coupon_code']) && !is_string($data['coupon_code'])) throw new InvalidArgumentException('Enter a valid coupon code.');
            $createdId = $discounts->addDiscount(
                $data['name'],
                $data['type'],
                $data['percentage'],
                $data['start_date'],
                $data['end_date'],
                $data['product_ids'],
                $data['coupon_code']
            );

            respond(201, [
                "success" => true,
                "message" => "Discount created successfully",
                "data" => $discounts->getById($createdId)
            ]);

        // PUT: update percentage and/or dates
        case 'PUT':

            if ($id === null) {
                respond(400, [
                    "success" => false,
                    "message" => "Discount ID is required"
                ]);
            }

            if ($discounts->getById($id) === false) {
                respond(404, [
                    "success" => false,
                    "message" => "Active discount not found"
                ]);
            }

            $data = readInput();

            $changes = array_intersect_key($data, array_flip(['percentage','start_date','end_date','product_ids','coupon_code']));
            if (!$changes) throw new InvalidArgumentException('Provide percentage, dates, or products to update.');
            foreach (['start_date','end_date'] as $field) if (array_key_exists($field,$changes)) $changes[$field]=validateDateTime($changes[$field],$field);
            $updated = $discounts->updateDiscount($id,$changes);
            respond(200, ['success'=>true,'message'=>'Discount updated','changed'=>$updated,'data'=>$discounts->getById($id)]);

        // DELETE: soft delete by setting is_active = 0
        case 'DELETE':

            if ($id === null) {
                respond(400, [
                    "success" => false,
                    "message" => "Discount ID is required"
                ]);
            }

            if ($discounts->getById($id) === false) {
                respond(404, [
                    "success" => false,
                    "message" => "Active discount not found"
                ]);
            }

            $discounts->deleteDiscount($id);

            respond(200, [
                "success" => true,
                "message" => "Discount deactivated successfully"
            ]);

        default:

            header('Allow: GET, POST, PUT, DELETE');

            respond(405, [
                "success" => false,
                "message" => "HTTP method not allowed"
            ]);
    }

} catch (PDOException $e) {
    error_log($e->getMessage());

    if (($e->errorInfo[1] ?? null) === 1062) respond(409, ['success'=>false,'message'=>'This coupon code already exists. Choose another code.']);
    if ($e->getCode() === '23000') {
        respond(409, [
            "success" => false,
            "message" => "A database constraint was violated"
        ]);
    }

    respond(500, [
        "success" => false,
        "message" => "A database error occurred"
    ]);

} catch (InvalidArgumentException $e) {
    respond(422, [
        "success" => false,
        "message" => $e->getMessage()
    ]);

} catch (Throwable $e) {
    error_log($e->getMessage());

    respond(500, [
        "success" => false,
        "message" => "An unexpected server error occurred"
    ]);
}
