<?php

/**
 * Detect the PHP framework of a project directory.
 *
 * @param string $sourceDir Directory containing extracted project files.
 * @return string Detected framework name.
 */
function detect_framework($sourceDir) {
    $sourceDir = rtrim($sourceDir, '/') . '/';

    // 1. Check for Laravel
    if (file_exists($sourceDir . 'artisan') || is_dir($sourceDir . 'app/Providers')) {
        return 'Laravel';
    }

    if (file_exists($sourceDir . 'composer.json')) {
        $composer = json_decode(file_get_contents($sourceDir . 'composer.json'), true);
        if (isset($composer['require']['laravel/framework'])) {
            return 'Laravel';
        }
    }

    // 2. Check for WordPress
    if (file_exists($sourceDir . 'wp-config.php') || is_dir($sourceDir . 'wp-admin') || is_dir($sourceDir . 'wp-includes')) {
        return 'WordPress';
    }

    // 3. Check for CodeIgniter
    if (file_exists($sourceDir . 'system/core/CodeIgniter.php') || is_dir($sourceDir . 'application/config')) {
        return 'CodeIgniter';
    }

    // Check if index.php references CodeIgniter or system folder
    if (file_exists($sourceDir . 'index.php')) {
        $indexContent = file_get_contents($sourceDir . 'index.php');
        if (strpos($indexContent, 'system_path') !== false && strpos($indexContent, 'application_folder') !== false) {
            return 'CodeIgniter';
        }
    }

    return 'Vanilla PHP';
}
