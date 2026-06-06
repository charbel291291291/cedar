/**
 * Standard order lifecycle for Charbel Card (admin + badges).
 * Flow: pending → pending_payment_review? → paid → processing → completed
 * Terminal: completed | rejected
 */
export const ORDER_FLOW_STATUSES = [
  'pending',
  'pending_payment_review',
  'paid',
  'processing',
  'completed',
  'rejected',
  'failed',
] as const

export type OrderFlowStatus = (typeof ORDER_FLOW_STATUSES)[number]

export const TERMINAL_ORDER_STATUSES: OrderFlowStatus[] = ['completed', 'rejected', 'failed']

export function isTerminalOrderStatus(status: string): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status as OrderFlowStatus)
}

/** Button styling: matches target status semantics (yellow / cyan / blue / green / red). */
export const ORDER_ACTION_BTN = {
  /** Target: pending_payment_review 🟡 */
  toReview: 'bg-amber-500/90 text-white hover:bg-amber-500 shadow-sm border-0',
  /** Target: paid (confirmed payment) */
  toPaid: 'bg-cyan-600 text-white hover:bg-cyan-600/90 shadow-sm border-0',
  /** Target: processing 🔵 */
  toProcessing: 'bg-blue-600 text-white hover:bg-blue-600/90 shadow-sm border-0',
  /** Target: completed 🟢 */
  toCompleted: 'bg-emerald-600 text-white hover:bg-emerald-600/90 shadow-sm border-0',
  /** Target: rejected 🔴 */
  toRejected: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm border-0',
} as const

export type OrderAdminLabelKey =
  | 'orderFlowSendToReview'
  | 'markPaid'
  | 'orderFlowStartProcessing'
  | 'markCompleted'
  | 'rejectOrder'
  | 'orderFlowRetryPaid'

export type OrderAdminAction = {
  next: OrderFlowStatus
  labelKey: OrderAdminLabelKey
  btnClass: string
}

/** Allowed admin transitions only — linear payment → fulfillment, plus reject anytime non-terminal. */
export function getOrderAdminActions(status: string): OrderAdminAction[] {
  const actions: OrderAdminAction[] = []
  const s = status as OrderFlowStatus

  switch (s) {
    case 'pending':
      actions.push({
        next: 'pending_payment_review',
        labelKey: 'orderFlowSendToReview',
        btnClass: ORDER_ACTION_BTN.toReview,
      })
      actions.push({
        next: 'paid',
        labelKey: 'markPaid',
        btnClass: ORDER_ACTION_BTN.toPaid,
      })
      break
    case 'pending_payment_review':
      actions.push({
        next: 'paid',
        labelKey: 'markPaid',
        btnClass: ORDER_ACTION_BTN.toPaid,
      })
      break
    case 'paid':
      actions.push({
        next: 'processing',
        labelKey: 'orderFlowStartProcessing',
        btnClass: ORDER_ACTION_BTN.toProcessing,
      })
      break
    case 'processing':
      actions.push({
        next: 'completed',
        labelKey: 'markCompleted',
        btnClass: ORDER_ACTION_BTN.toCompleted,
      })
      break
    case 'failed':
      actions.push({
        next: 'paid',
        labelKey: 'orderFlowRetryPaid',
        btnClass: ORDER_ACTION_BTN.toPaid,
      })
      break
    default:
      break
  }

  if (!isTerminalOrderStatus(s)) {
    actions.push({
      next: 'rejected',
      labelKey: 'rejectOrder',
      btnClass: ORDER_ACTION_BTN.toRejected,
    })
  }

  return actions
}
