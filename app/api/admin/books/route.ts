import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Get search and sort parameters from query string
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'title'
    const order = searchParams.get('order') || 'asc'

    // Query books with pending request counts using raw SQL for aggregation
    const { data: books, error } = await supabase.rpc('get_books_with_request_counts', {
      search_term: search || ''
    })

    if (error) {
      console.error('Error fetching books:', error)

      // Fallback: fetch books without aggregation if RPC doesn't exist
      const { data: fallbackBooks, error: fallbackError } = await supabase
        .from('books')
        .select('isbn, title, authors, publisher, thumbnail_url, quantity_available')
        .order(sort as any, { ascending: order === 'asc' })

      if (fallbackError) {
        return NextResponse.json(
          { error: 'Failed to fetch books' },
          { status: 500 }
        )
      }

      // Add pending_requests_count as 0 for fallback
      const formattedFallback = fallbackBooks.map(book => ({
        ...book,
        pending_requests_count: 0
      }))

      return NextResponse.json(formattedFallback)
    }

    return NextResponse.json(books)

  } catch (error) {
    console.error('Unexpected error fetching admin books:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
