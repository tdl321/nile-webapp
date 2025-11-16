# Development Tasks: Camera App vs Webapp

## Task Breakdown: What to Build Where

This document clearly separates what needs to be built in the iPhone scanner app versus what needs to be built in the Next.js webapp repository.

---

## 📱 Camera App (iPhone Scanner) - Tasks

### Current State
- ✅ Barcode scanning functionality works
- ✅ Can scan ISBN barcodes
- ✅ Has Supabase SDK integrated
- ❌ Uses **wrong API endpoint** (direct Supabase REST API)

### Required Changes

#### 1. Change API Endpoint (CRITICAL)

**Current (Wrong)**:
```swift
// ❌ Direct Supabase access - bypasses validation and sync
let response = try await supabase
  .from("scanned_books")
  .insert([
    "isbn": scannedISBN,
    "scanner_id": deviceIdentifier,
    "scanned_at": ISO8601DateFormatter().string(from: Date())
  ])
  .execute()
```

**Required (Correct)**:
```swift
// ✅ Use Next.js API endpoint - ensures proper sync
struct ScanRequest: Codable {
    let isbn: String
    let scannerId: String?

    enum CodingKeys: String, CodingKey {
        case isbn
        case scannerId = "scanner_id"
    }
}

struct ScanResponse: Codable {
    let success: Bool
    let scanId: String?
    let book: BookData?
    let warning: String?
    let error: String?
    let code: String?

    enum CodingKeys: String, CodingKey {
        case success
        case scanId = "scan_id"
        case book
        case warning
        case error
        case code
    }
}

struct BookData: Codable {
    let isbn: String
    let title: String
    let subtitle: String?
    let authors: [String]
    let publisher: String?
    let publishedDate: String?
    let thumbnailUrl: String?
    let quantityAvailable: Int

    enum CodingKeys: String, CodingKey {
        case isbn, title, subtitle, authors, publisher
        case publishedDate = "published_date"
        case thumbnailUrl = "thumbnail_url"
        case quantityAvailable = "quantity_available"
    }
}

func scanISBN(_ isbn: String) async throws -> ScanResponse {
    // 1. Prepare the request
    let url = URL(string: "https://your-app.vercel.app/api/scan")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    // 2. Create request body
    let scanRequest = ScanRequest(
        isbn: isbn,
        scannerId: UIDevice.current.identifierForVendor?.uuidString
    )
    request.httpBody = try JSONEncoder().encode(scanRequest)

    // 3. Make the request
    let (data, response) = try await URLSession.shared.data(for: request)

    // 4. Check response status
    guard let httpResponse = response as? HTTPURLResponse else {
        throw ScanError.invalidResponse
    }

    // 5. Decode response
    let scanResponse = try JSONDecoder().decode(ScanResponse.self, from: data)

    return scanResponse
}
```

#### 2. Update Configuration

**Add to app configuration**:
```swift
// Config.swift or similar
struct APIConfig {
    static let baseURL = "https://nile-webapp.vercel.app"

    #if DEBUG
    static let scanEndpoint = "http://localhost:3000/api/scan"
    #else
    static let scanEndpoint = "\(baseURL)/api/scan"
    #endif
}
```

#### 3. Improve Error Handling

```swift
enum ScanError: Error, LocalizedError {
    case invalidResponse
    case invalidISBN
    case networkError(Error)
    case serverError(String)
    case missingISBN

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response. Please try again."
        case .invalidISBN:
            return "This barcode is not a valid ISBN. Please scan a book's ISBN barcode."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let message):
            return "Server error: \(message)"
        case .missingISBN:
            return "ISBN is required"
        }
    }
}

// Usage in view
func handleScan(_ isbn: String) {
    Task {
        do {
            let response = try await scanISBN(isbn)

            if response.success {
                if let book = response.book {
                    // Show success with book info
                    showSuccess(book: book)
                } else if let warning = response.warning {
                    // Show warning (scan recorded but book fetch failed)
                    showWarning(warning)
                }
            } else {
                // Show error
                if let code = response.code {
                    switch code {
                    case "INVALID_ISBN":
                        showError(.invalidISBN)
                    case "MISSING_ISBN":
                        showError(.missingISBN)
                    default:
                        showError(.serverError(response.error ?? "Unknown error"))
                    }
                }
            }
        } catch {
            showError(.networkError(error))
        }
    }
}
```

#### 4. Add Retry Logic (Optional but Recommended)

```swift
func scanISBNWithRetry(_ isbn: String, maxRetries: Int = 3) async throws -> ScanResponse {
    var lastError: Error?

    for attempt in 1...maxRetries {
        do {
            return try await scanISBN(isbn)
        } catch {
            lastError = error

            // Don't retry on client errors (400s)
            if let scanError = error as? ScanError {
                switch scanError {
                case .invalidISBN, .missingISBN:
                    throw scanError // Don't retry these
                default:
                    break
                }
            }

            // Exponential backoff
            if attempt < maxRetries {
                let delay = TimeInterval(pow(2.0, Double(attempt - 1)))
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }
    }

    throw lastError ?? ScanError.invalidResponse
}
```

#### 5. Enhanced UI Feedback

```swift
// Show book information after successful scan
func showSuccess(book: BookData) {
    let message = """
    ✅ Scanned Successfully!

    Title: \(book.title)
    Authors: \(book.authors.joined(separator: ", "))
    Available: \(book.quantityAvailable) copies
    """

    // Display in alert or toast
    showAlert(title: "Book Found", message: message)
}
```

---

## 🌐 Webapp (Next.js) - Tasks

### Current State
- ✅ API route `/api/scan` exists and works correctly
- ✅ Syncs scanned_books → books tables
- ✅ Fetches Google Books API metadata
- ✅ Admin dashboard displays inventory
- ❌ Not being used by scanner app

### Required Changes

#### 1. No Changes Required to Core Logic! ✅

The `/api/scan/route.ts` already has everything needed:
- ✅ ISBN validation
- ✅ Google Books API integration
- ✅ Database sync logic
- ✅ Error handling

**Current implementation is perfect for the scanner app!**

#### 2. Optional Enhancements

##### A. Add Rate Limiting (Recommended)

Create `lib/rate-limit.ts`:
```typescript
import { LRUCache } from 'lru-cache'

type RateLimitOptions = {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max number of unique tokens per interval
}

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000,
  })

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0]
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount)
        }
        tokenCount[0] += 1

        const currentUsage = tokenCount[0]
        const isRateLimited = currentUsage >= limit

        return isRateLimited ? reject() : resolve()
      }),
  }
}

// Usage in API route
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 unique IPs per interval
})

export async function POST(request: NextRequest) {
  const ip = request.ip ?? 'anonymous'

  try {
    await limiter.check(10, ip) // 10 requests per minute per IP
  } catch {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', code: 'RATE_LIMIT' },
      { status: 429 }
    )
  }

  // ... rest of scan logic
}
```

##### B. Add Monitoring/Analytics (Optional)

```typescript
// app/api/scan/route.ts

// Track scan metrics
const metrics = {
  totalScans: 0,
  successfulScans: 0,
  failedScans: 0,
  invalidISBNs: 0,
  newBooks: 0,
  existingBooks: 0,
}

// After successful scan
metrics.totalScans++
if (existingBook) {
  metrics.existingBooks++
} else {
  metrics.newBooks++
  metrics.successfulScans++
}

// Log to analytics service (optional)
// await logToAnalytics({ event: 'book_scanned', isbn, scanner_id })
```

##### C. Add Webhook for Real-time Updates (Optional)

```typescript
// Notify admin when new books are added
if (!existingBook && bookData) {
  // Send webhook to Discord/Slack/Email
  await fetch(process.env.WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      content: `📚 New book added: **${bookData.title}** by ${bookData.authors.join(', ')}`
    })
  }).catch(err => console.error('Webhook failed:', err))
}
```

#### 3. Create Backfill Script (Important!)

Create `scripts/backfill-missing-books.ts`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isValidISBN, normalizeISBN } from '@/lib/utils/isbn-validator'
import { fetchBookByISBN, createPlaceholderBookMetadata } from '@/lib/google-books/client'

async function backfillMissingBooks() {
  console.log('🔍 Finding missing books...')

  const supabase = await createServiceRoleClient()

  // Find ISBNs in scanned_books but not in books
  const { data: missingISBNs, error } = await supabase
    .rpc('get_missing_book_isbns')

  if (error) {
    console.error('❌ Error querying missing books:', error)
    return
  }

  console.log(`📚 Found ${missingISBNs.length} missing books`)

  for (const { isbn } of missingISBNs) {
    const normalizedISBN = normalizeISBN(isbn)

    if (!isValidISBN(normalizedISBN)) {
      console.log(`⚠️  Invalid ISBN: ${isbn} - Skipping`)
      continue
    }

    console.log(`⏳ Fetching metadata for: ${normalizedISBN}`)

    try {
      const bookMetadata = await fetchBookByISBN(normalizedISBN)
      const bookToInsert = bookMetadata || createPlaceholderBookMetadata(normalizedISBN)

      const { error: insertError } = await supabase
        .from('books')
        .insert({
          isbn: normalizedISBN,
          ...bookToInsert,
          first_scanned_at: new Date().toISOString(),
          last_scanned_at: new Date().toISOString(),
          scan_count: 1,
        })

      if (insertError) {
        console.error(`❌ Error inserting ${normalizedISBN}:`, insertError)
      } else {
        console.log(`✅ Added: ${bookToInsert.title}`)
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.error(`❌ Error processing ${normalizedISBN}:`, error)
    }
  }

  console.log('✨ Backfill complete!')
}

backfillMissingBooks()
```

Add SQL function to help find missing books:

```sql
-- Create helper function
CREATE OR REPLACE FUNCTION get_missing_book_isbns()
RETURNS TABLE (isbn TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT sb.isbn
  FROM scanned_books sb
  LEFT JOIN books b ON sb.isbn = b.isbn
  WHERE b.isbn IS NULL;
END;
$$ LANGUAGE plpgsql;
```

Add to `package.json`:
```json
{
  "scripts": {
    "backfill-books": "tsx scripts/backfill-missing-books.ts"
  }
}
```

Run it:
```bash
npm run backfill-books
```

---

## 📋 Summary: Who Builds What

### 📱 Camera App Team Must:

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 **CRITICAL** | Change from Supabase direct access to `/api/scan` endpoint | 2-3 hours | Fixes sync issue |
| 🟡 **HIGH** | Update request/response models to match API spec | 1 hour | Proper data handling |
| 🟡 **HIGH** | Improve error handling for API responses | 1-2 hours | Better UX |
| 🟢 **MEDIUM** | Add retry logic for network failures | 1 hour | Reliability |
| 🟢 **MEDIUM** | Show book info after successful scan | 1 hour | User feedback |
| ⚪ **LOW** | Add loading states and animations | 2 hours | Polish |

**Total Effort: ~6-10 hours**

### 🌐 Webapp Team Must:

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 **CRITICAL** | Run backfill script for 4 missing books | 30 min | Fix existing data |
| 🟡 **HIGH** | Test `/api/scan` endpoint thoroughly | 1 hour | Ensure reliability |
| 🟢 **MEDIUM** | Add rate limiting to prevent abuse | 2 hours | Security |
| 🟢 **MEDIUM** | Add monitoring/logging | 1 hour | Observability |
| ⚪ **LOW** | Add webhook notifications | 1 hour | Admin alerts |

**Total Effort: ~2-4 hours**

---

## 🚀 Implementation Order

### Phase 1: Critical Fixes (Week 1)

1. **Webapp**: Run backfill script to add missing 4 books
2. **Camera App**: Update to use `/api/scan` endpoint
3. **Both**: Test end-to-end flow
4. **Both**: Verify data syncing correctly

### Phase 2: Enhancements (Week 2)

1. **Camera App**: Improve error handling and UX
2. **Webapp**: Add rate limiting
3. **Camera App**: Add retry logic
4. **Webapp**: Add monitoring

### Phase 3: Polish (Week 3+)

1. **Camera App**: Enhanced UI feedback
2. **Webapp**: Webhook notifications
3. **Both**: Performance optimization
4. **Both**: User testing and iteration

---

## 📝 Testing Checklist

### Camera App Tests

- [ ] Scan valid ISBN → Success response with book data
- [ ] Scan invalid ISBN → Proper error message
- [ ] Scan UPC barcode → Rejected with clear message
- [ ] Network failure → Retry mechanism works
- [ ] Duplicate scan → Updates existing book stats
- [ ] No internet → Graceful offline message

### Webapp Tests

- [ ] `/api/scan` returns correct response format
- [ ] ISBN validation works for all formats
- [ ] Google Books API fetched when needed
- [ ] Books table updated correctly
- [ ] scanned_books audit trail created
- [ ] Rate limiting prevents abuse
- [ ] Error responses are informative

---

## 🔗 Dependencies

### Camera App Needs:
- ✅ API endpoint URL (production + dev)
- ✅ API specification document (already created)
- ✅ Example request/response payloads
- ⏳ Testing server access (for development)

### Webapp Provides:
- ✅ `/api/scan` endpoint (already exists)
- ✅ API documentation (scanner-app-api-spec.md)
- ✅ Testing environment
- ⏳ Production URL (when deployed)

---

## 📊 Success Metrics

After implementation, measure:

1. **Data Consistency**
   - Target: 100% of scans create book records
   - Current: ~33% (2 out of 6 books exist)

2. **Error Rate**
   - Target: <5% failed scans
   - Track: Invalid ISBNs, network errors, API failures

3. **Response Time**
   - Target: <2 seconds for scan → response
   - Track: API latency, Google Books API calls

4. **User Satisfaction**
   - Target: Scanners receive immediate feedback
   - Track: User reports, scan success rate

---

## 🎯 Key Takeaway

### Camera App: Change 1 Line of Code
```swift
// From: Direct Supabase
supabase.from("scanned_books").insert(...)

// To: Next.js API
fetch("https://your-app.com/api/scan", { method: "POST", ... })
```

### Webapp: Run 1 Script
```bash
npm run backfill-books
```

**That's it!** Everything else is optional enhancements. 🎉
