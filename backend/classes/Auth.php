<?php

class Auth {
    private PDO $db;
    private array $config;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->config = require __DIR__ . '/../config/auth.php';
    }

    public function publicUser(array $user): array {
        $result = array_intersect_key($user, array_flip(['id', 'first_name', 'last_name', 'email', 'role']));
        $result['id'] = (int)$result['id'];
        return $result;
    }

    public function currentUser(): ?array {
        if (empty($_SESSION['user_id'])) return null;
        $now = time();
        if ($now - (int)($_SESSION['last_activity'] ?? 0) > $this->config['idle_timeout'] ||
            $now - (int)($_SESSION['signed_in_at'] ?? 0) > $this->config['absolute_timeout']) {
            $this->logout();
            return null;
        }
        $query = $this->db->prepare('SELECT id, first_name, last_name, email, role FROM users WHERE id = ?');
        $query->execute([$_SESSION['user_id']]);
        $user = $query->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            $this->logout();
            return null;
        }
        $_SESSION['role'] = $user['role'];
        $_SESSION['last_activity'] = $now;
        return $this->publicUser($user);
    }

    public function startLogin(array $user): array {
         
        session_regenerate_id(true);
        $_SESSION = [
            'user_id' => (int)$user['id'],
            'role' => $user['role'],
            'signed_in_at' => time(),
            'last_activity' => time(),
            'csrf_token' => bin2hex(random_bytes(32)),
        ];
        return $this->publicUser($user);
    }

    public function logout(): void {
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    public function checkLimit(string $key): void {
        $attempt = $_SESSION['auth_attempts'][$key] ?? null;
        if ($attempt && time() - (int)$attempt['started'] < 900 && (int)$attempt['count'] >= 10) {
            throw new RuntimeException('Too many attempts. Please wait 15 minutes.', 429);
        }
    }

    public function recordAttempt(string $key): void {
        $now = time();
        $attempts = $_SESSION['auth_attempts'] ?? [];
        foreach ($attempts as $id => $attempt) if ($now - (int)$attempt['started'] >= 900) unset($attempts[$id]);
        if (!isset($attempts[$key])) $attempts[$key] = ['started'=>$now,'count'=>0];
        $attempts[$key]['count']++;
        $_SESSION['auth_attempts'] = $attempts;
    }

    public function login(string $email, string $password): array {
        $query = $this->db->prepare('SELECT * FROM users WHERE email = ?');
        $query->execute([strtolower(trim($email))]);
        $user = $query->fetch(PDO::FETCH_ASSOC);
         
        $hash = $user['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
        if (!password_verify($password, $hash) || !$user || empty($user['password_hash'])) {
            throw new RuntimeException('Email or password is incorrect.', 401);
        }
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $query = $this->db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $query->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        return $this->startLogin($user);
    }

    public function register(array $data): array {
        $first = trim($data['first_name'] ?? '');
        $last = trim($data['last_name'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';
        if ($first === '' || $last === '' || mb_strlen($first) > 100 || mb_strlen($last) > 100 ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255 || strlen($password) < 12 || strlen($password) > 72) {
            throw new RuntimeException('Enter your name, a valid email and a password of 12–72 bytes.', 422);
        }
        try {
            $query = $this->db->prepare("INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'customer')");
            $query->execute([$first, $last, $email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new RuntimeException('An account already uses this email. Please sign in.', 409);
            throw $error;
        }
        return $this->startLogin(['id' => (int)$this->db->lastInsertId(), 'first_name' => $first, 'last_name' => $last, 'email' => $email, 'role' => 'customer']);
    }

    public function googleUser(array $claims, ?array $linkUser = null): array {
        $query = $this->db->prepare('SELECT * FROM users WHERE google_id = ?');
        $query->execute([$claims['sub']]);
        $existing = $query->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            if ($linkUser && (int)$existing['id'] !== (int)$linkUser['id']) {
                throw new RuntimeException('This Google account is already linked to another user.', 409);
            }
            return $this->startLogin($existing);
        }
        if ($linkUser) {
            $query = $this->db->prepare('SELECT google_id FROM users WHERE id = ?');
            $query->execute([$linkUser['id']]);
            if ($query->fetchColumn()) throw new RuntimeException('Your account is already linked to Google.', 409);
            $query = $this->db->prepare('UPDATE users SET google_id = ? WHERE id = ? AND google_id IS NULL');
            $query->execute([$claims['sub'], $linkUser['id']]);
            if ($query->rowCount() !== 1) throw new RuntimeException('Please reload and try again.', 409);
            return $this->startLogin($linkUser);
        }
        $query = $this->db->prepare('SELECT id FROM users WHERE email = ?');
        $email = strtolower($claims['email']);
        $query->execute([$email]);
        if ($query->fetchColumn()) {
            throw new RuntimeException('Sign in with your password first, then link Google from your account.', 409);
        }
        $first = mb_substr(trim($claims['given_name'] ?? 'Google'), 0, 100) ?: 'Google';
        $last = mb_substr(trim($claims['family_name'] ?? 'Member'), 0, 100) ?: 'Member';
        $query = $this->db->prepare("INSERT INTO users (first_name, last_name, email, google_id, role) VALUES (?, ?, ?, ?, 'customer')");
        $query->execute([$first, $last, $email, $claims['sub']]);
        return $this->startLogin(['id' => (int)$this->db->lastInsertId(), 'first_name' => $first, 'last_name' => $last, 'email' => $email, 'role' => 'customer']);
    }
}
