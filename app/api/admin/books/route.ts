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

    // Fetch all books
    let query = supabase
      .from('books')
      .select('isbn, title, authors, publisher, thumbnail_url, quantity_available')

    if (search) {
      query = query.or(`title.ilike.%${search}%,isbn.ilike.%${search}%`)
    }

    const { data: books, error: booksError } = await query.order(sort as any, { ascending: order === 'asc' })

    if (booksError) {
      console.error('Error fetching books:', booksError)
      return NextResponse.json(
        { error: 'Failed to fetch books' },
        { status: 500 }
      )
    }

    // Fetch all pending requests
    const { data: requests, error: requestsError } = await supabase
      .from('professor_requests')
      .select('id, professor_email, isbn, quantity_requested, requested_at, course_code, course_name')
      .eq('status', 'pending')

    if (requestsError) {
      console.error('Error fetching requests:', requestsError)
      return NextResponse.json(
        { error: 'Failed to fetch requests' },
        { status: 500 }
      )
    }

    // Group requests by ISBN and attach to books
    const requestsByIsbn = requests.reduce((acc: any, request) => {
      if (!acc[request.isbn]) {
        acc[request.isbn] = []
      }
      acc[request.isbn].push(request)
      return acc
    }, {})

    const booksWithRequests = books.map(book => ({
      ...book,
      pending_requests_count: requestsByIsbn[book.isbn]?.length || 0,
      requests: requestsByIsbn[book.isbn] || []
    }))

    return NextResponse.json(booksWithRequests)

  } catch (error) {
    console.error('Unexpected error fetching admin books:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
