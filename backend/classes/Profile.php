<?php

class Profile
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function getByUserId(int $userId): array|false
    {
        $query = $this->db->prepare(
            'SELECT id, first_name, last_name, email, phone, address, role
             FROM users
             WHERE id = ? AND is_active = 1'
        );
        $query->execute([$userId]);
        return $query->fetch(PDO::FETCH_ASSOC);
    }

    public function update(int $userId, array $data): array
    {
        $current = $this->getByUserId($userId);
        if ($current === false) {
            throw new RuntimeException('Your account could not be found.', 404);
        }

        $firstName = trim($data['first_name'] ?? $current['first_name']);
        $lastName = trim($data['last_name'] ?? $current['last_name']);
        $phone = trim($data['phone'] ?? $current['phone'] ?? '');
        $address = trim($data['address'] ?? $current['address'] ?? '');
        if (
            $firstName === '' ||
            $lastName === '' ||
            mb_strlen($firstName) > 100 ||
            mb_strlen($lastName) > 100 ||
            mb_strlen($phone) > 20 ||
            mb_strlen($address) > 1000
        ) {
            throw new RuntimeException('Enter a valid name, phone number and address.', 422);
        }

        $query = $this->db->prepare(
            'UPDATE users
             SET first_name = ?, last_name = ?, phone = ?, address = ?
             WHERE id = ? AND is_active = 1'
        );
        $query->execute([
            $firstName,
            $lastName,
            $phone === '' ? null : $phone,
            $address === '' ? null : $address,
            $userId,
        ]);

        $updated = $this->getByUserId($userId);
        if ($updated === false) {
            throw new RuntimeException('Your profile could not be loaded after saving.', 500);
        }
        return $updated;
    }

    public function changePassword(int $userId, string $currentPassword, string $newPassword): void
    {
        if (
            strlen($currentPassword) > 72 ||
            strlen($newPassword) < 12 ||
            strlen($newPassword) > 72
        ) {
            throw new RuntimeException('Your new password must be between 12 and 72 bytes.', 422);
        }

        $query = $this->db->prepare(
            'SELECT password_hash FROM users WHERE id = ? AND is_active = 1'
        );
        $query->execute([$userId]);
        $passwordHash = $query->fetchColumn();
        if (!$passwordHash || !password_verify($currentPassword, $passwordHash)) {
            throw new RuntimeException(
                'Your current password is incorrect, or this account uses Google sign-in.',
                403
            );
        }

        $query = $this->db->prepare(
            'UPDATE users SET password_hash = ? WHERE id = ? AND is_active = 1'
        );
        $query->execute([password_hash($newPassword, PASSWORD_DEFAULT), $userId]);
    }
}
