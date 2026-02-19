const { ADMIN_IDS } = require('./env');

// Admin roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
};

// Check if user is admin
const isAdmin = (userId) => {
  return ADMIN_IDS.includes(userId);
};

// Get admin role (for future role-based access)
const getAdminRole = (userId) => {
  if (ADMIN_IDS[0] === userId) {
    return ROLES.SUPER_ADMIN;
  }
  if (ADMIN_IDS.includes(userId)) {
    return ROLES.ADMIN;
  }
  return null;
};

module.exports = {
  ROLES,
  isAdmin,
  getAdminRole,
  ADMIN_IDS
};
