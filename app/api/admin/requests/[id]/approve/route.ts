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

    // Extract book data (Supabase returns it as an object, not array)
    const bookData = Array.isArray(requestData.books)
      ? requestData.books[0]
      : requestData.books as any

    // Check if enough books are available
    const quantityAvailable = bookData?.quantity_available || 0
    if (quantityAvailable < requestData.quantity_requested) {
      return NextResponse.json(
        { error: `Insufficient inventory. Only ${quantityAvailable} available.` },
        { status: 400 }
      )
    }

    // Update request to approved and reduce inventory
    const { error: updateError } = await supabase
      .from('professor_requests')
      .update({
        status: 'approved',
        quantity_approved: requestData.quantity_requested,
        processed_at: new Date().toISOString(),
        processed_by: user.id
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error approving request:', updateError)
      return NextResponse.json(
        { error: 'Failed to approve request' },
        { status: 500 }
      )
    }

    // Reduce book inventory - use service role client to bypass RLS
    const newQuantity = quantityAvailable - requestData.quantity_requested
    console.log(`[INVENTORY UPDATE] ISBN: ${requestData.isbn}`)
    console.log(`[INVENTORY UPDATE] Current quantity: ${quantityAvailable}`)
    console.log(`[INVENTORY UPDATE] Requested quantity: ${requestData.quantity_requested}`)
    console.log(`[INVENTORY UPDATE] New quantity: ${newQuantity}`)

    const serviceClient = await createServiceRoleClient()
    const { data: updateData, error: inventoryError } = await serviceClient
      .from('books')
      .update({
        quantity_available: newQuantity
      })
      .eq('isbn', requestData.isbn)
      .select()

    if (inventoryError) {
      console.error('[INVENTORY UPDATE] Error updating inventory:', inventoryError)
      // Note: In a production system, this should be wrapped in a transaction
      return NextResponse.json(
        { error: 'Failed to update inventory' },
        { status: 500 }
      )
    }

    console.log('[INVENTORY UPDATE] Update result:', updateData)

    return NextResponse.json({
      success: true,
      message: `Request approved for "${bookData?.title || 'book'}"`
    })

  } catch (error) {
    console.error('Unexpected error approving request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
