<?php

function requireCsrf(): void {


    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $token = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";

    if (
        !isset($_SESSION["csrf_token"]) ||
        !is_string($token) ||
        !hash_equals($_SESSION["csrf_token"], $token)
    ) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "Invalid CSRF token"
        ]);
        exit;
    }
}