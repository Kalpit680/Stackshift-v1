<?php

/**
 * Extract a ZIP archive to a destination directory.
 *
 * @param string $zipPath Absolute path to the ZIP file.
 * @param string $destination Absolute path to the destination directory.
 * @return bool True if successful, false otherwise.
 */
function unzip_project($zipPath, $destination) {
    if (!class_exists('ZipArchive')) {
        return false;
    }

    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== TRUE) {
        return false;
    }

    if (!is_dir($destination)) {
        mkdir($destination, 0777, true);
    }

    // Extract all files
    $zip->extractTo($destination);
    $zip->close();

    return true;
}
