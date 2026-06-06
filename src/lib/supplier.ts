import { supabase } from '@/lib/supabase'

const LOG = '[Supplier]'

export type SupplierSendResult =
  | { status: 'success'; data?: unknown }
  | {
      status: 'error'
      reason: 'supplier' | 'network' | 'config'
      message?: string
      data?: unknown
    }

/**
 * Sends a paid order to the supplier via Supabase Edge Function (`supplier-proxy`).
 * Secrets stay on the server; the anon key only invokes the function with the user JWT.
 */
export async function sendOrderToSupplier(orderId: string): Promise<SupplierSendResult> {
  const id = orderId?.trim()
  if (!id) {
    return { status: 'error', reason: 'config', message: 'Missing order id' }
  }

  try {
    const { data, error } = await supabase.functions.invoke('supplier-proxy', {
      body: { order_id: id },
    })

    if (error) {
      console.error(LOG, 'invoke', error)
      return {
        status: 'error',
        reason: 'network',
        message: error.message || 'Edge function request failed',
      }
    }

    const body = data as Record<string, unknown> | null

    if (body?.ok === true) {
      return { status: 'success', data: body.supplier ?? body }
    }

    const msg =
      typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
          : 'Supplier pipeline rejected the order'

    if (body?.error === 'supplier_failed' || body?.error === 'claim_rejected') {
      return {
        status: 'error',
        reason: 'supplier',
        message: msg,
        data: body,
      }
    }

    return {
      status: 'error',
      reason: 'config',
      message: msg,
      data: body,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error'
    console.error(LOG, message)
    return { status: 'error', reason: 'network', message }
  }
}

export function canSendOrderToSupplier(orderStatus: string): boolean {
  return orderStatus === 'paid'
}

export function isOrderSupplierProcessed(orderStatus: string): boolean {
  return ['processing', 'completed', 'rejected', 'failed'].includes(orderStatus)
}
