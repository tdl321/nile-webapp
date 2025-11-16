import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // Parse request body
    const body = await request.json()
    const { quantity_approved } = body

    // Validate quantity
    if (!quantity_approved || quantity_approved < 1) {
      return NextResponse.json(
        { error: 'Invalid quantity_approved: must be at least 1' },
        { status: 400 }
      )
    }

    // Get the request details
    const { data: requestData, error: fetchError } = await supabase
      .from('professor_requests')
      .select('id, isbn, quantity_requested, status, books(title, quantity_available)')
      .eq('id', id)
      .single()

    if (fetchError || !requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Check if request is already processed
    if (requestData.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${requestData.status}` },
        { status: 400 }
      )
    }

    // Validate quantity_approved doesn't exceed requested
    if (quantity_approved > requestData.quantity_requested) {
      return NextResponse.json(
        { error: `Cannot approve more than requested (${requestData.quantity_requested})` },
        { status: 400 }
      )
    }

    // Check if enough books are available
    const bookData = Array.isArray(requestData.books) ? requestData.books[0] : requestData.books
    const quantityAvailable = bookData?.quantity_available || 0
    if (quantityAvailable < quantity_approved) {
      return NextResponse.json(
        { error: `Insufficient inventory. Only ${quantityAvailable} available.` },
        { status: 400 }
      )
    }

    // Update request to partial
    const { error: updateError } = await supabase
      .from('professor_requests')
      .update({
        status: 'partial',
        quantity_approved: quantity_approved,
        processed_at: new Date().toISOString(),
        processed_by: user.id
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error partially approving request:', updateError)
      return NextResponse.json(
        { error: 'Failed to process partial approval' },
        { status: 500 }
      )
    }

    // Reduce book inventory - use service role client to bypass RLS
    const newQuantity = quantityAvailable - quantity_approved
    console.log(`[INVENTORY UPDATE - PARTIAL] ISBN: ${requestData.isbn}`)
    console.log(`[INVENTORY UPDATE - PARTIAL] Current quantity: ${quantityAvailable}`)
    console.log(`[INVENTORY UPDATE - PARTIAL] Approved quantity: ${quantity_approved}`)
    console.log(`[INVENTORY UPDATE - PARTIAL] New quantity: ${newQuantity}`)

    const serviceClient = await createServiceRoleClient()
    const { data: updateData, error: inventoryError } = await serviceClient
      .from('books')
      .update({
        quantity_available: newQuantity
      })
      .eq('isbn', requestData.isbn)
      .select()

    if (inventoryError) {
      console.error('[INVENTORY UPDATE - PARTIAL] Error updating inventory:', inventoryError)
      // Note: In a production system, this should be wrapped in a transaction
      return NextResponse.json(
        { error: 'Failed to update inventory' },
        { status: 500 }
      )
    }

    console.log('[INVENTORY UPDATE - PARTIAL] Update result:', updateData)

    return NextResponse.json({
      success: true,
      message: `Partially approved ${quantity_approved} of ${requestData.quantity_requested} for "${bookData?.title}"`
    })

  } catch (error) {
    console.error('Unexpected error in partial approval:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
