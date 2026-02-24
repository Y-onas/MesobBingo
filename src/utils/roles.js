// ─── Shared Role Definitions ────────────────────────────────────────
// Single source of truth for admin roles and hierarchy
// Used by both src/config/admin.js and src/services/config.service.js
// ────────────────────────────────────────────────────────────────────

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  FINANCE_ADMIN: 'finance_admin',
  SUPPORT_ADMIN: 'support_admin',
};

const ROLE_HIERARCHY = {
  super_admin: 4,
  admin: 3,
  finance_admin: 2,
  support_admin: 1,
};

module.exports = { ROLES, ROLE_HIERARCHY };
