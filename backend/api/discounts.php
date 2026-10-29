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
        'end_date' => $endDate
    ];
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
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

            respond(200, [
                "success" => true,
                ...$discounts->getDiscounts(
                    $page,
                    $name,
                    $startDate,
                    $endDate
                )
            ]);

        // POST: create discount
        case 'POST':

            $data = validateNewDiscount(readInput());

            $discounts->addDiscount(
                $data['name'],
                $data['type'],
                $data['percentage'],
                $data['start_date'],
                $data['end_date']
            );

            respond(201, [
                "success" => true,
                "message" => "Discount created successfully"
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

            $allowedFields = ['percentage', 'start_date', 'end_date'];

            if (count(array_intersect(
                array_keys($data),
                $allowedFields
            )) === 0) {
                respond(422, [
                    "success" => false,
                    "message" => "Provide percentage, start_date, or end_date"
                ]);
            }

            $amount = null;

            if (array_key_exists('percentage', $data)) {
                if (!is_numeric($data['percentage'])) {
                    respond(422, [
                        "success" => false,
                        "message" => "Percentage must be numeric"
                    ]);
                }

                $amount = (float) $data['percentage'];

                if ($amount < 0 || $amount > 100) {
                    respond(422, [
                        "success" => false,
                        "message" => "Percentage must be between 0 and 100"
                    ]);
                }
            }

            $startDate = array_key_exists('start_date', $data)
                ? validateDateTime($data['start_date'], 'start_date')
                : null;

            $endDate = array_key_exists('end_date', $data)
                ? validateDateTime($data['end_date'], 'end_date')
                : null;

            // Validate the resulting date range.
            $current = $discounts->getById($id);

            $finalStart = $startDate ?? $current['start_date'];
            $finalEnd = $endDate ?? $current['end_date'];

            if (
                $finalStart !== null &&
                $finalEnd !== null &&
                $finalStart > $finalEnd
            ) {
                respond(422, [
                    "success" => false,
                    "message" => "End date must be after start date"
                ]);
            }

            $updated = $discounts->updateDiscount(
                $id,
                $amount,
                $startDate,
                $endDate
            );

            respond(200, [
                "success" => true,
                "message" => "Discount update processed",
                "changed" => $updated
            ]);

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
