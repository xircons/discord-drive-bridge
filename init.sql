-- MySQL initialization script for Discord Drive Bridge
-- This script runs when the MySQL container starts for the first time

-- Create the database if it doesn't exist (already created by MYSQL_DATABASE env var)
-- USE discordbot;

-- Set MySQL to use utf8mb4 for proper Unicode support
ALTER DATABASE discordbot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED PRIMARY KEY,
    google_email VARCHAR(255) NOT NULL UNIQUE,
    encrypted_refresh_token TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    token_expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_google_email (google_email),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    INDEX idx_success (success),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    user_id BIGINT UNSIGNED NOT NULL,
    command VARCHAR(50) NOT NULL,
    count INT UNSIGNED DEFAULT 1,
    window_start DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, command),
    INDEX idx_window_start (window_start),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create backup_schedules table
CREATE TABLE IF NOT EXISTS backup_schedules (
    id VARCHAR(100) PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    folder_id VARCHAR(100) NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    last_run DATETIME,
    next_run DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_enabled (enabled),
    INDEX idx_next_run (next_run),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create backup_jobs table
CREATE TABLE IF NOT EXISTS backup_jobs (
    id VARCHAR(100) PRIMARY KEY,
    schedule_id VARCHAR(100) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    files_backed_up INT UNSIGNED DEFAULT 0,
    total_files INT UNSIGNED DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_schedule_id (schedule_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time),
    FOREIGN KEY (schedule_id) REFERENCES backup_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create file_metadata table for caching
CREATE TABLE IF NOT EXISTS file_metadata (
    id VARCHAR(100) PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT UNSIGNED,
    mime_type VARCHAR(100),
    folder_id VARCHAR(100),
    google_drive_id VARCHAR(100) NOT NULL,
    web_view_link TEXT,
    web_content_link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_folder_id (folder_id),
    INDEX idx_google_drive_id (google_drive_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create security_events table
CREATE TABLE IF NOT EXISTS security_events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED,
    event_type VARCHAR(50) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create user for the application
CREATE USER IF NOT EXISTS 'discordbot'@'%' IDENTIFIED BY 'secure_password_123';
CREATE USER IF NOT EXISTS 'discordbot'@'localhost' IDENTIFIED BY 'secure_password_123';
GRANT ALL PRIVILEGES ON discordbot.* TO 'discordbot'@'%';
GRANT ALL PRIVILEGES ON discordbot.* TO 'discordbot'@'localhost';
FLUSH PRIVILEGES;

-- Insert some initial data if needed
-- INSERT INTO users (id, google_email, encrypted_refresh_token, encrypted_access_token, token_expires_at) 
-- VALUES (123456789012345678, 'test@example.com', 'encrypted_token', 'encrypted_token', DATE_ADD(NOW(), INTERVAL 1 HOUR))
-- ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
