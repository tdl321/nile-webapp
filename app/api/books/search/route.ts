import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    // Validate query parameter
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const searchTerm = query.trim()

    // Search across ISBN, title, and authors
    // Using OR conditions for flexible search
    const { data: books, error } = await supabase
      .from('books')
      .select('isbn, title, subtitle, authors, publisher, thumbnail_url, quantity_available')
      .or(`isbn.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,authors.cs.{${searchTerm}}`)
      .limit(10)
      .order('quantity_available', { ascending: false }) // Show in-stock books first

    if (error) {
      console.error('Error searching books:', error)
      return NextResponse.json(
        { error: 'Failed to search books' },
        { status: 500 }
      )
    }

    // Format results
    const results = (books || []).map(book => ({
      isbn: book.isbn,
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors || [],
      publisher: book.publisher,
      thumbnail_url: book.thumbnail_url,
      quantity_available: book.quantity_available || 0
    }))

    return NextResponse.json({
      query: searchTerm,
      count: results.length,
      results
    })

  } catch (error) {
    console.error('Unexpected error in book search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
