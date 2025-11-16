# Scanner App API Specification

This document describes the API endpoints that the ISBN scanner mobile/camera app should use to communicate with the Nile web application.

## Base URL

```
https://your-deployment-url.com
```

For local development:
```
http://localhost:3000
```

## Authentication

The scanner app currently does not require authentication and uses direct Supabase access. However, for better integration and to ensure proper data syncing, the scanner should use the REST API endpoints described below.

---

## Endpoints

### 1. Scan ISBN

Records a book scan and automatically fetches metadata from Google Books API.

**Endpoint:** `POST /api/scan`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "isbn": "string (required)",
  "scanner_id": "string (optional)"
}
```

**Field Descriptions:**
- `isbn`: The ISBN number scanned from the book barcode. Can be ISBN-10 or ISBN-13 format. Hyphens and spaces will be automatically removed.
- `scanner_id`: Optional identifier for the scanner device (e.g., device UUID, location name)

**Success Response (200 OK):**
```json
{
  "success": true,
  "scan_id": "uuid",
  "book": {
    "isbn": "string",
    "title": "string",
    "subtitle": "string | null",
    "authors": ["string"],
    "publisher": "string | null",
    "published_date": "string | null",
    "description": "string | null",
    "page_count": "number | null",
    "categories": ["string"],
    "language": "string | null",
    "thumbnail_url": "string | null",
    "small_thumbnail_url": "string | null",
    "average_rating": "number | null",
    "ratings_count": "number | null",
    "scan_count": "number",
    "first_scanned_at": "timestamp",
    "last_scanned_at": "timestamp"
  }
}
```

**Warning Response (200 OK - Scan recorded but metadata fetch failed):**
```json
{
  "success": true,
  "scan_id": "uuid",
  "warning": "Scan recorded, but failed to store book metadata",
  "book": null
}
```

**Error Responses:**

*400 Bad Request - Missing ISBN:*
```json
{
  "success": false,
  "error": "ISBN is required",
  "code": "MISSING_ISBN"
}
```

*400 Bad Request - Invalid ISBN:*
```json
{
  "success": false,
  "error": "Invalid ISBN format",
  "code": "INVALID_ISBN"
}
```

*500 Internal Server Error - Database Error:*
```json
{
  "success": false,
  "error": "Database error while recording scan",
  "code": "DB_ERROR",
  "details": "string"
}
```

*500 Internal Server Error - Unexpected Error:*
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

### 2. API Health Check

Test endpoint to verify the API is running.

**Endpoint:** `GET /api/scan`

**Response (200 OK):**
```json
{
  "message": "ISBN Scanner API",
  "version": "1.0.0",
  "endpoints": {
    "scan": {
      "method": "POST",
      "path": "/api/scan",
      "body": {
        "isbn": "string (required)",
        "scanner_id": "string (optional)"
      }
    }
  }
}
```

---

## ISBN Format Notes

The API accepts both ISBN-10 and ISBN-13 formats and will automatically:
- Remove hyphens and spaces
- Normalize to the appropriate format
- Validate checksum digits

**Valid formats:**
- `9781234567897` (ISBN-13)
- `978-1-234-56789-7` (ISBN-13 with hyphens)
- `1234567890` (ISBN-10)
- `1-234-56789-0` (ISBN-10 with hyphens)

**Invalid formats:**
- UPC barcodes (e.g., `0038000265013`)
- URLs or non-numeric strings
- ISBNs with incorrect checksums

---

## Error Handling Best Practices

1. **Network Errors:** Implement retry logic with exponential backoff for network failures
2. **Invalid ISBNs:** Display user-friendly error message asking to rescan
3. **API Errors:** Log the error and optionally queue for retry
4. **Timeout:** Set reasonable timeout (e.g., 10 seconds) for API calls

---

## Example Usage

### Swift (iOS)
```swift
struct ScanRequest: Codable {
    let isbn: String
    let scannerId: String?

    enum CodingKeys: String, CodingKey {
        case isbn
        case scannerId = "scanner_id"
    }
}

func scanISBN(_ isbn: String, scannerId: String?) async throws -> ScanResponse {
    let url = URL(string: "https://your-app.com/api/scan")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = ScanRequest(isbn: isbn, scannerId: scannerId)
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        throw ScanError.invalidResponse
    }

    return try JSONDecoder().decode(ScanResponse.self, from: data)
}
```

### Kotlin (Android)
```kotlin
data class ScanRequest(
    val isbn: String,
    @SerializedName("scanner_id") val scannerId: String?
)

suspend fun scanISBN(isbn: String, scannerId: String?): ScanResponse {
    val request = ScanRequest(isbn, scannerId)

    return withContext(Dispatchers.IO) {
        val response = httpClient.post("https://your-app.com/api/scan") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }
        response.body()
    }
}
```

### JavaScript/React Native
```javascript
async function scanISBN(isbn, scannerId = null) {
  try {
    const response = await fetch('https://your-app.com/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isbn,
        scanner_id: scannerId,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Scan failed');
    }

    return data;
  } catch (error) {
    console.error('Scan error:', error);
    throw error;
  }
}
```

---

## Migration from Direct Supabase Access

If your scanner app is currently using direct Supabase REST API access (`POST /rest/v1/scanned_books`), you should migrate to the `/api/scan` endpoint to ensure:

1. Proper ISBN validation and normalization
2. Automatic Google Books metadata fetching
3. Correct book statistics tracking (scan_count, last_scanned_at)
4. Better error handling and feedback
5. Future-proof API as backend logic evolves

**Benefits of using the API endpoint:**
- Single source of truth for scan processing logic
- Automatic retry and error handling on server side
- Consistent data validation
- Better monitoring and logging
- No need to manage Supabase credentials in the scanner app

---

## Support

For questions or issues with the API, please contact the development team or create an issue in the project repository.
