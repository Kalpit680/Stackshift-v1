<?php

/**
 * Detect the PHP version used in a project.
 *
 * @param string $sourceDir Directory containing extracted project files.
 * @return string Detected PHP version (e.g. '5.4', '5.6', '7.4', '8.0').
 */
function detect_php_version($sourceDir) {
    $sourceDir = rtrim($sourceDir, '/') . '/';

    // 1. Try reading composer.json
    if (file_exists($sourceDir . 'composer.json')) {
        $composer = json_decode(file_get_contents($sourceDir . 'composer.json'), true);
        if (isset($composer['require']['php'])) {
            $phpReq = $composer['require']['php'];
            // Basic extraction: find first version-like pattern (e.g., 5.6, 7.4, 8.0)
            if (preg_match('/(\d+\.\d+(\.\d+)?)/', $phpReq, $matches)) {
                return $matches[1];
            }
        }
    }

    // 2. Scan PHP files for version-specific keywords/syntax as heuristic
    // For example, if we find 'mysql_connect', it is highly likely PHP 5.6 or lower.
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($sourceDir));
    $hasMysqlConnect = false;
    $hasScalarTypes = false; // PHP 7+ scalar type declarations in function parameters (e.g. ': string' or 'int $x')
    $hasArrowFunctions = false; // PHP 7.4+ (fn() => ...)

    $phpFileCount = 0;
    foreach ($files as $file) {
        if ($file->isFile() && strtolower($file->getExtension()) === 'php') {
            $phpFileCount++;
            if ($phpFileCount > 50) {
                // Limit scan to 50 files for speed
                break;
            }
            $content = file_get_contents($file->getRealPath());
            if (strpos($content, 'mysql_connect') !== false) {
                $hasMysqlConnect = true;
            }
            if (preg_match('/:\s*(string|int|bool|float|array)/i', $content)) {
                $hasScalarTypes = true;
            }
            if (preg_match('/fn\s*\([^)]*\)\s*=>/i', $content)) {
                $hasArrowFunctions = true;
            }
        }
    }

    if ($hasArrowFunctions) {
        return '7.4';
    }
    if ($hasScalarTypes) {
        return '7.0';
    }
    if ($hasMysqlConnect) {
        return '5.6';
    }

    // Default fallback
    return '5.6';
}
