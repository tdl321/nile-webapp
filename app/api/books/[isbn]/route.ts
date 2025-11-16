import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ isbn: string }> }
) {
  try {
    const supabase = await createClient()
    const { isbn } = await params

    // Validate ISBN format (basic validation)
    if (!isbn || isbn.length < 10) {
      return NextResponse.json(
        { error: 'Invalid ISBN format' },
        { status: 400 }
      )
    }

    // Query the books table for the ISBN
    const { data: book, error } = await supabase
      .from('books')
      .select('isbn, title, subtitle, authors, publisher, published_date, thumbnail_url, quantity_available')
      .eq('isbn', isbn)
      .single()

    if (error) {
      console.error('Error fetching book:', error)
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }

    // Return book data with availability
    return NextResponse.json({
      isbn: book.isbn,
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors || [],
      publisher: book.publisher,
      published_date: book.published_date,
      thumbnail_url: book.thumbnail_url,
      quantity_available: book.quantity_available || 0
    })

  } catch (error) {
    console.error('Unexpected error in book lookup:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
