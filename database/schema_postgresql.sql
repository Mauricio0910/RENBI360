-- RenBI 360 - esquema gerencial de referência para PostgreSQL
-- Ajustar tamanhos, tipos fiscais e particionamento conforme volume real.

create table if not exists bi_company (
  company_id varchar(50) primary key,
  name varchar(200) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists bi_branch (
  company_id varchar(50) not null references bi_company(company_id),
  branch_id varchar(50) not null,
  name varchar(200) not null,
  state char(2), city varchar(120),
  primary key(company_id, branch_id)
);

create table if not exists bi_product (
  company_id varchar(50) not null,
  product_id varchar(100) not null,
  sku varchar(100), barcode varchar(30), name varchar(250) not null,
  category_id varchar(100), brand varchar(120), unit varchar(20),
  current_cost numeric(18,6), sale_price numeric(18,6),
  min_stock numeric(18,6), max_stock numeric(18,6), lead_time_days integer,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(company_id, product_id)
);

create table if not exists bi_seller (
  company_id varchar(50) not null,
  seller_id varchar(100) not null,
  name varchar(200) not null,
  team_id varchar(100), manager_id varchar(100), active boolean default true,
  primary key(company_id, seller_id)
);

create table if not exists bi_supplier (
  company_id varchar(50) not null,
  supplier_id varchar(100) not null,
  name varchar(250) not null, tax_id varchar(30),
  state char(2), city varchar(120), payment_terms_days integer,
  active boolean default true,
  primary key(company_id, supplier_id)
);

create table if not exists bi_cost_center (
  company_id varchar(50) not null,
  cost_center_id varchar(100) not null,
  code varchar(50), name varchar(200) not null,
  parent_id varchar(100), active boolean default true,
  primary key(company_id, cost_center_id)
);

create table if not exists bi_sale (
  company_id varchar(50) not null,
  branch_id varchar(50), sale_id varchar(100) not null,
  document_number varchar(100), issued_at timestamptz not null,
  customer_id varchar(100), seller_id varchar(100), channel varchar(50),
  gross_total numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  net_total numeric(18,2) not null default 0,
  cost_total numeric(18,2) not null default 0,
  status varchar(30) not null,
  updated_at timestamptz not null default now(),
  primary key(company_id, sale_id)
);
create index if not exists ix_bi_sale_date on bi_sale(company_id, issued_at);
create index if not exists ix_bi_sale_seller on bi_sale(company_id, seller_id, issued_at);

create table if not exists bi_sale_item (
  company_id varchar(50) not null,
  sale_item_id varchar(100) not null,
  sale_id varchar(100) not null,
  product_id varchar(100) not null,
  quantity numeric(18,6) not null,
  unit_price numeric(18,6) not null,
  discount numeric(18,2) not null default 0,
  net_total numeric(18,2) not null,
  unit_cost numeric(18,6) not null default 0,
  primary key(company_id, sale_item_id)
);
create index if not exists ix_bi_sale_item_product on bi_sale_item(company_id, product_id);
create index if not exists ix_bi_sale_item_sale on bi_sale_item(company_id, sale_id);

create table if not exists bi_purchase (
  company_id varchar(50) not null,
  branch_id varchar(50), purchase_id varchar(100) not null,
  supplier_id varchar(100), issued_at timestamptz,
  received_at timestamptz, gross_total numeric(18,2) default 0,
  discount numeric(18,2) default 0, freight numeric(18,2) default 0,
  net_total numeric(18,2) default 0, status varchar(30),
  primary key(company_id, purchase_id)
);

create table if not exists bi_purchase_item (
  company_id varchar(50) not null,
  purchase_item_id varchar(100) not null,
  purchase_id varchar(100) not null,
  product_id varchar(100) not null,
  quantity numeric(18,6) not null,
  unit_cost numeric(18,6) not null,
  net_total numeric(18,2) not null,
  primary key(company_id, purchase_item_id)
);

create table if not exists bi_inventory_snapshot (
  company_id varchar(50) not null,
  branch_id varchar(50) not null,
  snapshot_at timestamptz not null,
  product_id varchar(100) not null,
  quantity numeric(18,6) not null,
  reserved_quantity numeric(18,6) not null default 0,
  avg_cost numeric(18,6) not null default 0,
  primary key(company_id, branch_id, snapshot_at, product_id)
);
create index if not exists ix_inv_product_date on bi_inventory_snapshot(company_id, product_id, snapshot_at desc);

create table if not exists bi_expense (
  company_id varchar(50) not null,
  expense_id varchar(100) not null,
  competence_date date not null,
  payment_date date,
  cost_center_id varchar(100), supplier_id varchar(100),
  category varchar(120), nature varchar(20) check (nature in ('fixed','variable')),
  amount numeric(18,2) not null, status varchar(30),
  primary key(company_id, expense_id)
);
create index if not exists ix_expense_competence on bi_expense(company_id, competence_date, cost_center_id);

create table if not exists bi_accounting_entry (
  company_id varchar(50) not null,
  entry_id varchar(100) not null,
  competence_date date not null,
  account_code varchar(80) not null,
  account_name varchar(250), cost_center_id varchar(100),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  history text, source_document_id varchar(100),
  primary key(company_id, entry_id)
);
create index if not exists ix_acc_entry_date_account on bi_accounting_entry(company_id, competence_date, account_code);

create table if not exists bi_sales_target (
  company_id varchar(50) not null,
  seller_id varchar(100) not null,
  period_start date not null,
  period_end date not null,
  target_amount numeric(18,2) not null,
  target_quantity numeric(18,2),
  primary key(company_id, seller_id, period_start, period_end)
);

create table if not exists bi_supplier_evaluation (
  company_id varchar(50) not null,
  supplier_id varchar(100) not null,
  reference_date date not null,
  price_score numeric(6,2), delivery_score numeric(6,2),
  quality_score numeric(6,2), terms_score numeric(6,2),
  total_score numeric(6,2), notes text,
  primary key(company_id, supplier_id, reference_date)
);

create table if not exists bi_sync_batch (
  company_id varchar(50) not null,
  batch_id varchar(100) primary key,
  idempotency_key varchar(200) not null unique,
  source_system varchar(100) not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status varchar(30) not null,
  accepted integer not null default 0,
  rejected integer not null default 0,
  error_message text
);

-- RenBI 360 v1.1 - segurança, licença e contas a pagar/receber
create table if not exists bi_app_user (
  company_id varchar(50) not null,
  user_id varchar(100) not null,
  username varchar(120) not null,
  display_name varchar(200) not null,
  password_hash varchar(500) not null,
  role varchar(30) not null check (role in ('admin','manager','sales','finance','viewer')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(company_id, user_id),
  unique(company_id, username)
);

create table if not exists bi_license (
  company_id varchar(50) primary key,
  plan_code varchar(80) not null,
  status varchar(30) not null check (status in ('active','grace','blocked','cancelled')),
  due_date date,
  grace_until date,
  blocked_at timestamptz,
  block_reason varchar(500),
  billing_contact varchar(250),
  updated_at timestamptz not null default now()
);

create table if not exists bi_financial_title (
  company_id varchar(50) not null,
  title_id varchar(100) not null,
  title_type varchar(20) not null check (title_type in ('payable','receivable')),
  person_id varchar(100),
  person_name varchar(250),
  document_number varchar(100),
  issue_date date,
  due_date date not null,
  settlement_date date,
  original_amount numeric(18,2) not null,
  open_amount numeric(18,2) not null,
  status varchar(30) not null,
  seller_id varchar(100),
  cost_center_id varchar(100),
  updated_at timestamptz not null default now(),
  primary key(company_id, title_id)
);
create index if not exists ix_fin_title_due on bi_financial_title(company_id, title_type, due_date, status);
create index if not exists ix_fin_title_person on bi_financial_title(company_id, person_id, title_type, status);

create table if not exists bi_collection_action (
  company_id varchar(50) not null,
  action_id varchar(100) not null,
  customer_id varchar(100) not null,
  title_id varchar(100),
  action_at timestamptz not null,
  action_type varchar(50) not null,
  notes text,
  next_action_at timestamptz,
  user_id varchar(100),
  primary key(company_id, action_id)
);
