export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "cashier" | "kitchen" | "waiter";
export type OrderSource = "customer_qr" | "cashier";
export type OrderType = "dine_in" | "takeaway";
export type OrderStatus =
  | "pending"
  | "paid"
  | "ready"
  | "served"
  | "expired"
  | "cancelled";
export type PaymentMethod = "cash" | "qris";
export type RefundReasonCategory = "outlet_fault" | "other";

export interface InstantNotificationEvents {
  refund: boolean;
  paid_cancellation: boolean;
  discount: boolean;
  price_or_setting_change: boolean;
}

export interface OutletRow {
  id: string;
  name: string;
  address: string | null;
  receipt_footer: string | null;
  order_expiry_minutes: number;
  tax_enabled: boolean;
  tax_percent: number | null;
  service_enabled: boolean;
  service_percent: number | null;
  price_includes_tax: boolean;
  qris_enabled: boolean;
  qris_raw_payload: string | null;
  qris_merchant_name: string | null;
  max_cashier_discount_percent: number | null;
  max_cashier_discount_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettingsRow {
  id: string;
  outlet_id: string;
  owner_email: string | null;
  monthly_report_enabled: boolean;
  instant_events: InstantNotificationEvents;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  outlet_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CategoryRow {
  id: string;
  outlet_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductRow {
  id: string;
  outlet_id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TableRow {
  id: string;
  outlet_id: string;
  table_no: number;
  name: string;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrderRow {
  id: string;
  outlet_id: string;
  order_no: string;
  source: OrderSource;
  order_type: OrderType;
  table_id: string | null;
  payment_choice: PaymentMethod;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  discount_reason: string | null;
  service_rate: number | null;
  service_amount: number;
  tax_rate: number | null;
  tax_amount: number;
  price_includes_tax: boolean;
  total: number;
  version: number;
  idempotency_key: string | null;
  customer_claimed_paid_at: string | null;
  tracking_expired_at: string | null;
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
  paid_by: string | null;
  served_by: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  deleted_at: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  qty: number;
  note: string | null;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount_received: number;
  change_amount: number;
  created_by: string;
  created_at: string;
}

export interface RefundRow {
  id: string;
  order_id: string;
  payment_id: string;
  amount: number;
  reason_category: RefundReasonCategory;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  outlet_id: string | null;
  user_id: string | null;
  role: string | null;
  device: string | null;
  ip: string | null;
  action: string;
  entity: string;
  entity_id: string;
  before: Json | null;
  after: Json | null;
  reason: string | null;
  prev_hash: string;
  hash: string;
  created_at: string;
}
