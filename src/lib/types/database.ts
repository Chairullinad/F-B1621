export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "cashier" | "warehouse" | "kitchen" | "waiter";
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
  emoji?: string;
  cogs_estimate?: number;
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
  cooking_started_at?: string | null;
  cogs_amount?: number;
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

export interface IngredientStorageStock {
  gudang: number;
  dapur: number;
  bar: number;
}

export interface IngredientRow {
  id: string;
  outlet_id: string;
  name: string;
  category: string;
  unit: "kg" | "gram" | "liter" | "ml" | "pcs" | "porsi";
  current_stock: number;
  min_stock: number;
  unit_cost: number;
  storage_stock: IngredientStorageStock;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductRecipeRow {
  id: string;
  outlet_id: string;
  product_id: string;
  ingredient_id: string;
  qty_per_portion: number;
  created_at: string;
}

export interface StockMovementRow {
  id: string;
  outlet_id: string;
  ingredient_id: string;
  movement_type:
    | "sale_deduct"
    | "refund_restore"
    | "po_receive"
    | "opname_adjustment"
    | "waste"
    | "transfer_out"
    | "transfer_in"
    | "manual_adjustment";
  qty_delta: number;
  stock_before: number;
  stock_after: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SupplierRow {
  id: string;
  outlet_id: string;
  name: string;
  category: string;
  contact: string;
  address: string;
  payment_term: "COD" | "7 Hari" | "14 Hari" | "30 Hari";
  rating: number;
  payable_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PurchaseOrderItemJson {
  ingredient_id: string;
  ingredient_name: string;
  qty: number;
  unit: string;
  unit_cost: number;
  subtotal: number;
}

export interface PurchaseOrderRow {
  id: string;
  outlet_id: string;
  po_no: string;
  supplier_id: string;
  supplier_name_snapshot: string;
  order_date: string;
  status: "pending" | "dikirim" | "diterima" | "lunas" | "cancelled";
  items_summary: string;
  items_json: PurchaseOrderItemJson[];
  total_amount: number;
  paid_amount: number;
  notes: string | null;
  created_by: string | null;
  received_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockOpnameItemJson {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  system_qty: number;
  physical_qty: number;
  variance_qty: number;
  unit_cost: number;
  variance_amount: number;
}

export interface StockOpnameRow {
  id: string;
  outlet_id: string;
  opname_no: string;
  opname_date: string;
  status: "draft" | "waiting_approval" | "approved" | "rejected";
  items_json: StockOpnameItemJson[];
  total_variance_amount: number;
  notes: string | null;
  photo_evidence_note: string | null;
  digital_signature: string | null;
  submitted_by_name: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WasteLogRow {
  id: string;
  outlet_id: string;
  waste_date: string;
  ingredient_id: string;
  ingredient_name_snapshot: string;
  qty: number;
  unit: string;
  reason: "Busuk" | "Expired" | "Tumpah" | "Rusak Produksi" | "Lainnya";
  cost_amount: number;
  recorded_by_name: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface StockTransferRow {
  id: string;
  outlet_id: string;
  transfer_no: string;
  transfer_date: string;
  from_location: string;
  to_location: string;
  ingredient_id: string;
  ingredient_name_snapshot: string;
  qty: number;
  unit: string;
  total_value: number;
  status: "pending" | "in_transit" | "received" | "cancelled";
  sender_name: string;
  receiver_name: string | null;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AccountingJournalSourceType =
  | "order_paid"
  | "order_cogs"
  | "order_refund"
  | "po_received"
  | "po_paid"
  | "waste"
  | "opname"
  | "transfer"
  | "expense_salary"
  | "expense_rent"
  | "expense_utility"
  | "expense_other"
  | "asset_purchase"
  | "owner_capital"
  | "tax_payment"
  | "manual";

export interface AccountingJournalRow {
  id: string;
  outlet_id: string;
  journal_no: string;
  entry_date: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  source_type: AccountingJournalSourceType;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}
