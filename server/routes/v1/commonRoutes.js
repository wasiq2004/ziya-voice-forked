/**
 * V1 Common Routes Controller
 * Handles non-role-specific endpoints
 * 
 * Routes:
 * POST /auth/login - User and Admin login
 * POST /auth/signup - User registration
 * GET /auth/google - Google OAuth initiation
 * GET /auth/google/callback - Google OAuth callback
 * POST /auth/logout - User logout
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  normalizeOrganizationSlug,
  PLATFORM_ORG_SLUG
} = require('../../services/organizationService.js');
const { getPublicOriginFromBackendUrl } = require('../../config/backendUrl.js');

const PLATFORM_PUBLIC_ORIGIN = getPublicOriginFromBackendUrl();

const getOrganizationLoginUrl = (slug) => {
  if (!slug || !PLATFORM_PUBLIC_ORIGIN) {
    return '/login';
  }

  const normalizedSlug = normalizeOrganizationSlug(slug);
  if (!normalizedSlug) {
    return '/login';
  }

  return `${PLATFORM_PUBLIC_ORIGIN.replace(/\/$/, '')}/${normalizedSlug}/login`;
};

// Initialize services through app context
let authService, mysqlPool, walletService, companyService, organizationService;

/**
 * Initialize controller with required dependencies
 */
function initCommonController(auth, pool, wallet, company, organization) {
  authService = auth;
  mysqlPool = pool;
  walletService = wallet;
  companyService = company;
  organizationService = organization;
}

// ==================== LOGIN & REGISTRATION ====================

function getRequestedOrganizationSlug(req) {
  const paramSlug = req.params?.orgSlug;
  if (paramSlug) {
    return normalizeOrganizationSlug(paramSlug);
  }

  const segments = String(req.path || req.originalUrl || '')
    .split('?')[0]
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const terminalSegment = segments[segments.length - 1];
  if (['login', 'signup'].includes(terminalSegment) && segments.length >= 2) {
    const candidateSlug = segments[segments.length - 2];
    if (candidateSlug && candidateSlug !== 'auth') {
      return normalizeOrganizationSlug(candidateSlug);
    }
  }

  return null;
}

async function validateTenantContext(user, organizationSlug) {
  const normalizedTenantSlug = normalizeOrganizationSlug(organizationSlug);

  if (!normalizedTenantSlug) {
    if (user.role === 'super_admin') {
      return { allowed: true };
    }

    if (user.role === 'org_admin') {
      return { allowed: true };
    }

    if (!user.organization_id) {
      return { allowed: true };
    }

    const organization = await organizationService.getOrganization(user.organization_id);
    if (normalizeOrganizationSlug(organization.slug || organization.name) === PLATFORM_ORG_SLUG) {
      return { allowed: true };
    }

    return {
      allowed: false,
      status: 403,
      message: `Use your organization login URL: ${getOrganizationLoginUrl(organization.slug)}`
    };
  }

  if (user.role === 'super_admin') {
    return {
      allowed: false,
      status: 403,
      message: 'Super admin accounts must log in from the main platform URL.'
    };
  }

  const tenantOrganization = await organizationService.getOrganizationBySlug(normalizedTenantSlug);
  if (!tenantOrganization) {
    return {
      allowed: false,
      status: 404,
      message: 'Organization login not found for this path.'
    };
  }

  if (tenantOrganization.status !== 'active') {
    return {
      allowed: false,
      status: 403,
      message: 'This organization is inactive.'
    };
  }

  if (Number(user.organization_id) !== Number(tenantOrganization.id)) {
    return {
      allowed: false,
      status: 403,
      message: `This account does not belong to ${tenantOrganization.name}.`
    };
  }

  return { allowed: true };
}

async function handlePathLoginRequest(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const organizationSlug = getRequestedOrganizationSlug(req);
    const organization = organizationSlug ? await organizationService.getOrganizationBySlug(organizationSlug) : null;

    if (organizationSlug && !organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const user = await authService.authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (user.status && user.status !== 'active') {
      const reason = user.status === 'locked' ? 'account is locked' : 'account is inactive';
      return res.status(403).json({
        success: false,
        message: `Access denied: Your ${reason}`
      });
    }

    const loginContext = await validateTenantContext(user, organizationSlug);
    if (!loginContext.allowed) {
      return res.status(loginContext.status || 403).json({
        success: false,
        message: loginContext.message
      });
    }

    if (organization) {
      user.organization_name = organization.name;
      user.organization_slug = organization.slug;
      user.organization_logo_url = organization.logo_url || user.organization_logo_url || null;
    }

    if (!user.current_company_id) {
      const [companies] = await mysqlPool.execute(
        'SELECT id FROM companies WHERE user_id = ?',
        [user.id]
      );
      if (companies.length === 0) {
        const org = await organizationService.getOrganization(user.organization_id);
        const companyName = `${org.name} company`;
        const companyId = uuidv4();
        await mysqlPool.execute(
          'INSERT INTO companies (id, user_id, name) VALUES (?, ?, ?)',
          [companyId, user.id, companyName]
        );
        await mysqlPool.execute(
          'UPDATE users SET current_company_id = ? WHERE id = ?',
          [companyId, user.id]
        );
        user.current_company_id = companyId;
      } else {
        await mysqlPool.execute(
          'UPDATE users SET current_company_id = ? WHERE id = ?',
          [companies[0].id, user.id]
        );
        user.current_company_id = companies[0].id;
      }
    }

    const [planRows] = await mysqlPool.execute(
      'SELECT plan_type, plan_valid_until, trial_started_at FROM users WHERE id = ?',
      [user.id]
    );
    if (planRows.length > 0) {
      user.plan_type = planRows[0].plan_type;
      user.plan_valid_until = planRows[0].plan_valid_until;
      user.trial_started_at = planRows[0].trial_started_at;
    }

    res.json({
      success: true,
      user,
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
}

async function handlePathSignupRequest(req, res) {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, username, and password are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 alphanumeric characters'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const organizationSlug = getRequestedOrganizationSlug(req);
    let organizationId = 5;
    if (organizationSlug) {
      const organization = await organizationService.getOrganizationBySlug(organizationSlug);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      if (organization.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'This organization is inactive'
        });
      }

      organizationId = organization.id;
    }

    const user = await authService.registerUser(email, username, password, organizationId);

    const org = await organizationService.getOrganization(user.organization_id);
    const companyName = `${org.name} company`;
    const companyId = uuidv4();
    await mysqlPool.execute(
      'INSERT INTO companies (id, user_id, name) VALUES (?, ?, ?)',
      [companyId, user.id, companyName]
    );

    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    await mysqlPool.execute(
      `UPDATE users SET current_company_id = ?, plan_type = 'trial', plan_valid_until = ?, trial_started_at = ? WHERE id = ?`,
      [companyId, trialEnd, trialStart, user.id]
    );

    await walletService.getOrCreateWallet(user.id);
    await walletService.addCredits(user.id, 50, 'Trial signup bonus');

    res.json({
      success: true,
      user: {
        ...user,
        current_company_id: companyId,
        plan_type: 'trial',
        plan_valid_until: trialEnd
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    if (error.message === 'User already exists') {
      return res.status(409).json({
        success: false,
        message: 'Email already in use'
      });
    }
    console.error('Registration error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message
    });
  }
}

router.post('/auth/login', handlePathLoginRequest);
router.post('/auth/:orgSlug/login', handlePathLoginRequest);
router.post('/auth/signup', handlePathSignupRequest);
router.post('/auth/:orgSlug/signup', handlePathSignupRequest);

// POST /api/v1/common/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password, organizationSlug } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await authService.authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check account status
    if (user.status && user.status !== 'active') {
      const reason = user.status === 'locked' ? 'account is locked' : 'account is inactive';
      return res.status(403).json({
        success: false,
        message: `Access denied: Your ${reason}`
      });
    }

    const loginContext = await validateTenantContext(user, organizationSlug);
    if (!loginContext.allowed) {
      return res.status(loginContext.status || 403).json({
        success: false,
        message: loginContext.message
      });
    }

    // Default company check
    if (!user.current_company_id) {
      const [companies] = await mysqlPool.execute(
        'SELECT id FROM companies WHERE user_id = ?',
        [user.id]
      );
      if (companies.length === 0) {
        const org = await organizationService.getOrganization(user.organization_id);
        const companyName = `${org.name} company`;
        const companyId = uuidv4();
        await mysqlPool.execute(
          'INSERT INTO companies (id, user_id, name) VALUES (?, ?, ?)',
          [companyId, user.id, companyName]
        );
        await mysqlPool.execute(
          'UPDATE users SET current_company_id = ? WHERE id = ?',
          [companyId, user.id]
        );
        user.current_company_id = companyId;
      } else {
        await mysqlPool.execute(
          'UPDATE users SET current_company_id = ? WHERE id = ?',
          [companies[0].id, user.id]
        );
        user.current_company_id = companies[0].id;
      }
    }

    // Attach plan info
    const [planRows] = await mysqlPool.execute(
      'SELECT plan_type, plan_valid_until, trial_started_at FROM users WHERE id = ?',
      [user.id]
    );
    if (planRows.length > 0) {
      user.plan_type = planRows[0].plan_type;
      user.plan_valid_until = planRows[0].plan_valid_until;
      user.trial_started_at = planRows[0].trial_started_at;
    }

    res.json({
      success: true,
      user,
      apiVersion: 'v1'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = {
  router,
  initCommonController
};

