-- جدول users الحالي يحتوي password_hash و google_id و role بالفعل.
-- لا يغيّر الحسابات الموجودة ولا ينشئ كلمة مرور افتراضية.
CREATE TABLE IF NOT EXISTS auth_login_attempts (
    attempt_key CHAR(64) PRIMARY KEY,
    attempts INT NOT NULL DEFAULT 0,
    window_started DATETIME NOT NULL,
    blocked_until DATETIME NULL
) ENGINE=InnoDB;
