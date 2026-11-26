-- This product is intentionally scoped to HR and attendance management.
-- The following modules and their local-development data are removed by request.

DELETE FROM "role_permissions"
WHERE "permissionId" IN (
  SELECT id FROM permissions WHERE module IN ('finance', 'inventory', 'crm')
);

DELETE FROM permissions WHERE module IN ('finance', 'inventory', 'crm');
DELETE FROM "user_roles" WHERE "roleId" IN (SELECT id FROM roles WHERE name = 'FINANCE');
DELETE FROM roles WHERE name = 'FINANCE';

DROP TABLE IF EXISTS interactions CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS pipeline_stages CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS reimbursements CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

DROP TYPE IF EXISTS "InvoiceStatus";
DROP TYPE IF EXISTS "ExpenseStatus";
DROP TYPE IF EXISTS "ReimbursementStatus";
DROP TYPE IF EXISTS "StockMovementType";
DROP TYPE IF EXISTS "CustomerType";
DROP TYPE IF EXISTS "LeadStatus";
