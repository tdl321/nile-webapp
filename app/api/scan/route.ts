import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isValidISBN, normalizeISBN } from '@/lib/utils/isbn-validator'
import { fetchBookByISBN, createPlaceholderBookMetadata } from '@/lib/google-books/client'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { isbn, scanner_id } = body

    // Validate ISBN is provided
    if (!isbn) {
      return NextResponse.json(
        {
          success: false,
          error: 'ISBN is required',
          code: 'MISSING_ISBN',
        },
        { status: 400 }
      )
    }

    // Normalize and validate ISBN format
    const normalizedISBN = normalizeISBN(isbn)

    if (!isValidISBN(normalizedISBN)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid ISBN format',
          code: 'INVALID_ISBN',
        },
        { status: 400 }
      )
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = await createServiceRoleClient()

    // Step 1: Insert scan record into scanned_books table
    const { data: scanData, error: scanError } = await supabase
      .from('scanned_books')
      .insert({
        isbn: normalizedISBN,
        scanner_id: scanner_id || null,
        scanned_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (scanError) {
      console.error('Error inserting scan:', scanError)
      return NextResponse.json(
        {
          success: false,
          error: 'Database error while recording scan',
          code: 'DB_ERROR',
          details: scanError.message,
        },
        { status: 500 }
      )
    }

    // Step 2: Check if book exists in books table
    const { data: existingBook } = await supabase
      .from('books')
      .select('*')
      .eq('isbn', normalizedISBN)
      .single()

    let bookData = existingBook

    // Step 3: If book doesn't exist, fetch from Google Books API
    if (!existingBook) {
      console.log(`Book not found in database, fetching from Google Books API: ${normalizedISBN}`)

      const bookMetadata = await fetchBookByISBN(normalizedISBN)

      // Create book record (either from API or placeholder)
      const bookToInsert = bookMetadata || createPlaceholderBookMetadata(normalizedISBN)

      const { data: newBook, error: bookError } = await supabase
        .from('books')
        .insert({
          isbn: normalizedISBN,
          ...bookToInsert,
          first_scanned_at: new Date().toISOString(),
          last_scanned_at: new Date().toISOString(),
          scan_count: 1,
          quantity_available: 1, // First scan = 1 book in inventory
        })
        .select()
        .single()

      if (bookError) {
        console.error('Error inserting book:', bookError)
        // Scan was recorded, but book insertion failed
        return NextResponse.json(
          {
            success: true,
            scan_id: scanData.id,
            warning: 'Scan recorded, but failed to store book metadata',
            book: null,
          },
          { status: 200 }
        )
      }

      bookData = newBook
    } else {
      // Step 4: Update existing book stats and increment quantity
      const updatedData = {
        last_scanned_at: new Date().toISOString(),
        scan_count: (existingBook.scan_count || 0) + 1,
        quantity_available: (existingBook.quantity_available || 0) + 1, // Increment inventory by 1
      }

      const { error: updateError } = await supabase
        .from('books')
        .update(updatedData)
        .eq('isbn', normalizedISBN)

      if (updateError) {
        console.error('Error updating book stats:', updateError)
        // Non-fatal error, continue
      }

      // Update bookData with the new values for the response
      bookData = {
        ...existingBook,
        ...updatedData,
      }
    }

    // Step 5: Return success response
    return NextResponse.json(
      {
        success: true,
        scan_id: scanData.id,
        book: bookData,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error in /api/scan:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json(
    {
      message: 'ISBN Scanner API',
      version: '1.0.0',
      endpoints: {
        scan: {
          method: 'POST',
          path: '/api/scan',
          body: {
            isbn: 'string (required)',
            scanner_id: 'string (optional)',
          },
        },
      },
    },
    { status: 200 }
  )
}
