<?php

use Illuminate\Support\Facades\Route;

Route::post('/start-migration', function () {

    // Path to the projects.json file
    $path = dirname(base_path()) . DIRECTORY_SEPARATOR . 'projects.json';

    if (!file_exists($path)) {
        return response()->json([
            "success" => false,
            "message" => "projects.json not found"
        ], 404);
    }

    // Read the JSON file
    $projects = json_decode(file_get_contents($path), true);

    if (empty($projects)) {
        return response()->json([
            "success" => false,
            "message" => "No projects found"
        ], 404);
    }

    // Get the latest project (first item in the array)
    $latestProject = $projects[0];

    // Return only the required fields
    return response()->json([
        "user_name"    => $latestProject["user_name"],
        "project_name" => $latestProject["project_name"],
        "zip_url"      => $latestProject["zip_url"]
    ]);
});