<?php
ini_set('display_errors', '0');
set_time_limit(120);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST'); http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Use POST to send a message.']); exit;
    }
    require_once __DIR__ . '/../config/db.php';
    require_once __DIR__ . '/../classes/ShoppingAssistant.php';
    require_once __DIR__ . '/../classes/Auth.php';
    require_once __DIR__ . '/../middleware/csrf.php';
    requireCsrf();
    $body = file_get_contents('php://input', false, null, 0, 16001);
    if (strlen($body) > 16000) throw new InvalidArgumentException('The conversation is too long. Start a new chat.');
    $data = json_decode($body, true);
    if (!is_array($data) || !is_string($data['message'] ?? null)) throw new InvalidArgumentException('Enter a message.');
    $message = trim($data['message']);
    if ($message === '' || mb_strlen($message) > 700) throw new InvalidArgumentException('Use a message of 1–700 characters.');
    $history = $data['history'] ?? [];
    if (!is_array($history) || count($history) > 8) throw new InvalidArgumentException('Start a new chat or shorten the history.');
    foreach ($history as $row) {
        if (!is_array($row) || !in_array($row['role'] ?? '', ['user','assistant'], true) || !is_string($row['content'] ?? null) || mb_strlen($row['content']) > 1000) {
            throw new InvalidArgumentException('Invalid conversation history.');
        }
    }
    $now = time();
    $requests = array_values(array_filter($_SESSION['customer_chat_requests'] ?? [], function ($time) use ($now) { return $time > $now - 60; }));
    if (count($requests) >= 8) {
        http_response_code(429); header('Retry-After: 60');
        echo json_encode(['success' => false, 'message' => 'Please wait a minute before sending more messages.']); exit;
    }
    $requests[] = $now; $_SESSION['customer_chat_requests'] = $requests;
    $db = (new Database())->connect();
    session_write_close();
    $answer = (new ShoppingAssistant($db))->answer($message, $history, $data);
    echo json_encode(['success' => true] + $answer, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (InvalidArgumentException $error) {
    http_response_code(400); echo json_encode(['success' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Eco Marc customer chat failed: ' . get_class($error));
    http_response_code(503); echo json_encode(['success' => false, 'message' => 'The shopping assistant is unavailable. Please try again shortly.']);
}
