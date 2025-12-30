<?php
/**
 * MyUB Offline Status Beacon Endpoint
 * Handles beacon requests to set user offline status
 * This is more reliable than async JS calls during page unload
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get request data
$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);

// Validate data
if (!isset($data['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing user_id']);
    exit;
}

$userId = $data['user_id'];

// Supabase configuration
$SUPABASE_URL = getenv('SUPABASE_URL') ?: 'YOUR_SUPABASE_URL';
$SUPABASE_ANON_KEY = getenv('SUPABASE_ANON_KEY') ?: 'YOUR_SUPABASE_ANON_KEY';

// Call Supabase RPC to update status
try {
    $ch = curl_init();
    
    curl_setopt_array($ch, [
        CURLOPT_URL => "$SUPABASE_URL/rest/v1/rpc/update_online_status",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'apikey: ' . $SUPABASE_ANON_KEY,
            'Authorization: Bearer ' . $SUPABASE_ANON_KEY
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'is_online_status' => false
        ]),
        CURLOPT_TIMEOUT => 3 // Quick timeout
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    curl_close($ch);
    
    if ($httpCode === 200 || $httpCode === 204) {
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'User set offline']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update status', 'http_code' => $httpCode]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
