<?php

/**
 * Load migration rules for a given language, source version, and target version.
 *
 * @param string $language Language name (e.g. 'php').
 * @param string $sourceVersion Source version (e.g. '5.6').
 * @param string $targetVersion Target version (e.g. '7.4').
 * @return array Loaded rules list.
 */
function load_migration_rules($language, $sourceVersion, $targetVersion) {
    $langDir = __DIR__ . '/../knowledge_base/' . strtolower($language) . '/';
    
    // Heuristic rule filename mapping
    $ruleFile = $langDir . "rules_{$sourceVersion}_to_{$targetVersion}.json";
    
    // Fallback if exact matching file not found
    if (!file_exists($ruleFile)) {
        // Look for any rules file in the language folder
        $files = glob($langDir . "*.json");
        if (!empty($files)) {
            $ruleFile = $files[0];
        } else {
            return [];
        }
    }

    $rulesJson = file_get_contents($ruleFile);
    $rules = json_decode($rulesJson, true);
    
    return is_array($rules) ? $rules : [];
}
