
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../classes/Customer.php";
require_once __DIR__ . "/../middleware/admin.php";
require_once __DIR__ . "/../middleware/csrf.php";

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function readInput(): array
{
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        respond(400, [
            "success" => false,
            "message" => "Request body must be valid JSON"
        ]);
    }

    return $data;
}

function validateCustomer(array $data): array
{
    foreach (["first_name", "last_name", "email"] as $field) {
        if (!isset($data[$field]) || !is_string($data[$field])) {
            respond(422, [
                "success" => false,
                "message" => "First name, last name and email must be strings"
            ]);
        }
    }

    foreach (["phone", "address"] as $field) {
        if (isset($data[$field]) && !is_string($data[$field])) {
            respond(422, [
                "success" => false,
                "message" => "Phone and address must be strings"
            ]);
        }
    }

    $firstName = trim($data["first_name"]);
    $lastName  = trim($data["last_name"]);
    $email     = trim($data["email"]);
    $phone     = trim($data["phone"] ?? "");
    $address   = trim($data["address"] ?? "");

    if ($firstName === "" || $lastName === "" || $email === "") {
        respond(422, [
            "success" => false,
            "message" => "First name, last name and email are required"
        ]);
    }

    if (
        !filter_var($email, FILTER_VALIDATE_EMAIL) ||
        strlen($firstName) > 100 ||
        strlen($lastName) > 100 ||
        strlen($email) > 255 ||
        strlen($phone) > 20 ||
        strlen($address) > 2000
    ) {
        respond(422, [
            "success" => false,
            "message" => "Invalid or oversized customer data"
        ]);
    }

    return [
        "first_name" => $firstName,
        "last_name"  => $lastName,
        "email"      => $email,
        "phone"      => $phone,
        "address"    => $address
    ];
}

try {
    requireAdmin();

    $method = $_SERVER["REQUEST_METHOD"] ?? "";
    if (in_array($method, ["POST", "PUT", "DELETE"], true)) {
        requireCsrf();
    }

    $database = new Database();
    $db = $database->connect();
    $customer = new Customer($db);

    $id = null;

    if (isset($_GET["id"])) {
        $id = filter_var(
            $_GET["id"],
            FILTER_VALIDATE_INT,
            ["options" => ["min_range" => 1]]
        );

        if ($id === false) {
            respond(400, [
                "success" => false,
                "message" => "Invalid customer ID"
            ]);
        }
    }

    switch ($method) {
        case "GET":
            if ($id !== null) {
                $result = $customer->getById($id);

                if ($result === false) {
                    respond(404, [
                        "success" => false,
                        "message" => "Customer not found"
                    ]);
                }

                respond(200, [
                    "success" => true,
                    "data" => $result
                ]);
            }

            $search = $_GET["search"] ?? "";
            if (!is_string($search)) {
                respond(400, [
                    "success" => false,
                    "message" => "Search must be a string"
                ]);
            }
            $search = trim($search);

            respond(200, [
                "success" => true,
                "data" => $customer->getAll($search)
            ]);

        case "POST":
            $data = validateCustomer(readInput());
            $newId = $customer->create($data);

            respond(201, [
                "success" => true,
                "message" => "Customer created successfully",
                "id" => $newId
            ]);

        case "PUT":
            if ($id === null) {
                respond(400, [
                    "success" => false,
                    "message" => "Customer ID is required"
                ]);
            }

            if ($customer->getById($id) === false) {
                respond(404, [
                    "success" => false,
                    "message" => "Customer not found"
                ]);
            }

            $data = validateCustomer(readInput());
            $customer->update($id, $data);

            respond(200, [
                "success" => true,
                "message" => "Customer updated successfully"
            ]);

        case "DELETE":
            if ($id === null) {
                respond(400, [
                    "success" => false,
                    "message" => "Customer ID is required"
                ]);
            }

            if ($customer->getById($id) === false) {
                respond(404, [
                    "success" => false,
                    "message" => "Customer not found"
                ]);
            }

            $customer->delete($id);

            respond(200, [
                "success" => true,
                "message" => "Customer deleted successfully"
            ]);

        default:
            header("Allow: GET, POST, PUT, DELETE");

            respond(405, [
                "success" => false,
                "message" => "HTTP method not allowed"
            ]);
    }
} catch (PDOException $e) {
    error_log($e->getMessage());

    if ($e->getCode() === "23000") {
        respond(409, [
            "success" => false,
            "message" => "Email already exists or customer has related records"
        ]);
    }

    respond(500, [
        "success" => false,
        "message" => "A database error occurred"
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());

    respond(500, [
        "success" => false,
        "message" => "An unexpected server error occurred"
    ]);
}
