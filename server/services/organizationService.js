/**
 * OrganizationService manages organizations and org-admin user accounts.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const PLATFORM_ORG_SLUG = 'ziya';
const PLATFORM_ORG_ID = 5;

function normalizeOrganizationSlug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

class OrganizationService {
    constructor(mysqlPool) {
        this.mysqlPool = mysqlPool;
    }

    async ensureTenantSchema() {
        const [[slugColumn]] = await this.mysqlPool.execute(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'organizations'
        AND COLUMN_NAME = 'slug'
    `);

        if (!slugColumn.total) {
            await this.mysqlPool.execute(
                'ALTER TABLE organizations ADD COLUMN slug VARCHAR(120) NULL'
            );
        }

        const [organizations] = await this.mysqlPool.execute(`
      SELECT id, name, slug
      FROM organizations
      ORDER BY id ASC
    `);

        const usedSlugs = new Set();

        for (const organization of organizations) {
            let nextSlug = normalizeOrganizationSlug(organization.slug || organization.name);

            if (!nextSlug) {
                nextSlug = `org-${organization.id}`;
            }

            if (this.isPlatformOrganization(organization)) {
                nextSlug = PLATFORM_ORG_SLUG;
            }

            let uniqueSlug = nextSlug;
            let suffix = 2;

            while (usedSlugs.has(uniqueSlug)) {
                uniqueSlug = `${nextSlug}-${suffix++}`;
            }

            usedSlugs.add(uniqueSlug);

            if (organization.slug !== uniqueSlug) {
                await this.mysqlPool.execute(
                    'UPDATE organizations SET slug = ? WHERE id = ?',
                    [uniqueSlug, organization.id]
                );
            }
        }

        try {
            await this.mysqlPool.execute(
                'CREATE UNIQUE INDEX idx_organizations_slug ON organizations (slug)'
            );
        } catch (error) {
            if (!String(error.message || '').toLowerCase().includes('duplicate')) {
                throw error;
            }
        }
    }

    async generateUniqueSlug(name, excludeOrgId = null) {
        const baseSlug = normalizeOrganizationSlug(name) || 'organization';
        let candidate = baseSlug;
        let suffix = 2;

        while (true) {
            const params = [candidate];
            let query = 'SELECT id FROM organizations WHERE slug = ?';

            if (excludeOrgId) {
                query += ' AND id != ?';
                params.push(excludeOrgId);
            }

            const [rows] = await this.mysqlPool.execute(query, params);
            if (rows.length === 0) return candidate;

            candidate = `${baseSlug}-${suffix++}`;
        }
    }

    async listOrganizations() {
        const [rows] = await this.mysqlPool.execute(`
      SELECT
        o.*,
        COUNT(DISTINCT CASE WHEN u.role = 'org_admin' THEN u.id END) AS admin_count,
        COUNT(DISTINCT CASE WHEN u.role IN ('user', 'individual_user') THEN u.id END) AS user_count,
        COALESCE(SUM(CASE WHEN u.role = 'org_admin' THEN w.balance ELSE 0 END), 0) AS credit_balance
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      LEFT JOIN user_wallets w ON w.user_id = u.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

        return rows;
    }

    async getOrganization(orgId) {
        const [rows] = await this.mysqlPool.execute(
            'SELECT * FROM organizations WHERE id = ?',
            [orgId]
        );

        if (rows.length === 0) throw new Error('Organization not found');
        return rows[0];
    }

    async getOrganizationBySlug(slug) {
        const normalizedSlug = normalizeOrganizationSlug(slug);
        if (!normalizedSlug) return null;

        const [rows] = await this.mysqlPool.execute(
            'SELECT * FROM organizations WHERE slug = ? LIMIT 1',
            [normalizedSlug]
        );

        return rows[0] || null;
    }

    isPlatformOrganization(organization) {
        if (!organization) return false;
        const normalizedName = normalizeOrganizationSlug(organization.name);
        return Number(organization.id) === PLATFORM_ORG_ID
            || normalizeOrganizationSlug(organization.slug || organization.name) === PLATFORM_ORG_SLUG
            || normalizedName === 'ziya-organization'
            || normalizedName === 'ziya';
    }

    async createOrganization(name, createdBy, logo_url = null) {
        const slug = await this.generateUniqueSlug(name);

        const [result] = await this.mysqlPool.execute(
            'INSERT INTO organizations (name, slug, created_by, status, logo_url) VALUES (?, ?, ?, ?, ?)',
            [name, slug, createdBy || null, 'active', logo_url]
        );

        const [org] = await this.mysqlPool.execute(
            'SELECT * FROM organizations WHERE id = ?',
            [result.insertId]
        );

        return org[0];
    }

    async updateOrganization(orgId, { name, status, logo_url, slug }) {
        const organization = await this.getOrganization(orgId);
        const fields = [];
        const values = [];

        if (name !== undefined) {
            fields.push('name = ?');
            values.push(name);
        }

        if (slug !== undefined || name !== undefined) {
            const slugSeed = slug !== undefined ? slug : name;
            let nextSlug;

            if (this.isPlatformOrganization(organization) || normalizeOrganizationSlug(slugSeed) === PLATFORM_ORG_SLUG) {
                nextSlug = PLATFORM_ORG_SLUG;
            } else {
                nextSlug = await this.generateUniqueSlug(slugSeed, orgId);
            }

            fields.push('slug = ?');
            values.push(nextSlug);
        }

        if (status !== undefined) {
            fields.push('status = ?');
            values.push(status);
        }

        if (logo_url !== undefined) {
            fields.push('logo_url = ?');
            values.push(logo_url);
        }

        if (fields.length === 0) throw new Error('Nothing to update');

        values.push(orgId);
        await this.mysqlPool.execute(
            `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return this.getOrganization(orgId);
    }

    async disableOrganization(orgId) {
        await this.mysqlPool.execute(
            "UPDATE organizations SET status = 'inactive' WHERE id = ?",
            [orgId]
        );
    }

    async listOrgAdmins() {
        const [rows] = await this.mysqlPool.execute(`
      SELECT u.id, u.email, u.username, u.organization_id, u.status, u.created_at,
             o.name AS organization_name, o.slug AS organization_slug
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.role = 'org_admin'
      ORDER BY u.created_at DESC
    `);

        return rows;
    }

    async createOrgAdmin({ email, username, password, organization_id }) {
        await this.getOrganization(organization_id);

        const [existing] = await this.mysqlPool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) throw new Error('Email already in use');

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const userId = crypto.randomBytes(8).toString('hex');

        await this.mysqlPool.execute(
            `INSERT INTO users (id, email, username, password_hash, role, organization_id, status)
       VALUES (?, ?, ?, ?, 'org_admin', ?, 'active')`,
            [userId, email, username, passwordHash, organization_id]
        );

        const [rows] = await this.mysqlPool.execute(
            `SELECT u.id, u.email, u.username, u.organization_id, u.status, u.created_at,
              o.name AS organization_name, o.slug AS organization_slug
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = ?`,
            [userId]
        );

        return rows[0];
    }

    async updateOrgAdmin(adminId, { email, username, password, organization_id }) {
        const [existingRows] = await this.mysqlPool.execute(
            `SELECT u.id, u.email, u.username, u.organization_id, u.status, u.created_at,
                    o.name AS organization_name, o.slug AS organization_slug
             FROM users u
             LEFT JOIN organizations o ON o.id = u.organization_id
             WHERE u.id = ? AND u.role = 'org_admin'`,
            [adminId]
        );

        if (existingRows.length === 0) {
            throw new Error('Org Admin not found');
        }

        const currentAdmin = existingRows[0];
        const nextOrganizationId = organization_id !== undefined ? organization_id : currentAdmin.organization_id;

        if (nextOrganizationId) {
            await this.getOrganization(nextOrganizationId);
        }

        if (email && email !== currentAdmin.email) {
            const [emailRows] = await this.mysqlPool.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, adminId]
            );
            if (emailRows.length > 0) throw new Error('Email already in use');
        }

        const updates = [];
        const values = [];

        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }

        if (username !== undefined) {
            updates.push('username = ?');
            values.push(username);
        }

        if (organization_id !== undefined) {
            updates.push('organization_id = ?');
            values.push(nextOrganizationId);
        }

        if (password !== undefined && password.trim()) {
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            updates.push('password_hash = ?');
            values.push(passwordHash);
        }

        if (updates.length === 0) {
            throw new Error('Nothing to update');
        }

        values.push(adminId);
        await this.mysqlPool.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND role = 'org_admin'`,
            values
        );

        const [updatedRows] = await this.mysqlPool.execute(
            `SELECT u.id, u.email, u.username, u.organization_id, u.status, u.created_at,
                    o.name AS organization_name, o.slug AS organization_slug
             FROM users u
             LEFT JOIN organizations o ON o.id = u.organization_id
             WHERE u.id = ?`,
            [adminId]
        );

        return updatedRows[0];
    }

    async getSuperAdminStats() {
        const [[orgCount]] = await this.mysqlPool.execute(
            "SELECT COUNT(*) AS total FROM organizations"
        );
        const [[orgAdminCount]] = await this.mysqlPool.execute(
            "SELECT COUNT(*) AS total FROM users WHERE role = 'org_admin'"
        );
        const [[userCount]] = await this.mysqlPool.execute(
            "SELECT COUNT(*) AS total FROM users WHERE role IN ('user', 'individual_user')"
        );
        const [[activeUsers]] = await this.mysqlPool.execute(`
      SELECT COUNT(DISTINCT user_id) AS total
      FROM user_service_usage
      WHERE period_start >= DATE_FORMAT(NOW(), '%Y-%m-01')
    `);
        const [[creditsUsed]] = await this.mysqlPool.execute(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM wallet_transactions
      WHERE transaction_type = 'debit'
    `);

        const [[creditsAvailable]] = await this.mysqlPool.execute(`
      SELECT COALESCE(SUM(credit_balance), 0) AS total
      FROM organizations
    `);

        const [orgBreakdown] = await this.mysqlPool.execute(`
      SELECT
        o.id, o.name, o.slug, o.status,
        COUNT(DISTINCT CASE WHEN u.role = 'org_admin' THEN u.id END) AS admin_count,
        COUNT(DISTINCT CASE WHEN u.role IN ('user', 'individual_user') THEN u.id END) AS user_count,
        COALESCE((
          SELECT SUM(wt.amount)
          FROM users u2
          INNER JOIN wallet_transactions wt ON wt.user_id = u2.id
          WHERE u2.organization_id = o.id
            AND wt.transaction_type = 'debit'
        ), 0) AS credits_used
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      GROUP BY o.id
      ORDER BY credits_used DESC, user_count DESC
      LIMIT 20
    `);

        const [serviceUsage] = await this.mysqlPool.execute(`
      SELECT
        service_name,
        COUNT(DISTINCT user_id) AS user_count,
        SUM(usage_amount) AS total_usage
      FROM user_service_usage
      WHERE period_start >= DATE_FORMAT(NOW(), '%Y-%m-01')
      GROUP BY service_name
    `);

        return {
            totalOrganizations: orgCount.total,
            totalOrgAdmins: orgAdminCount.total,
            totalUsers: userCount.total,
            activeUsers: activeUsers.total,
            totalCreditsUsed: parseFloat(creditsUsed.total) || 0,
            totalCreditsAvailable: parseFloat(creditsAvailable.total) || 0,
            orgBreakdown,
            serviceUsage,
        };
    }

    async listAllUsers({ page = 1, limit = 50, search = '', orgId = null } = {}) {
        const offset = (page - 1) * limit;
        const params = [];
        let where = "WHERE u.role = 'user'";

        if (search) {
            where += " AND (u.email LIKE ? OR u.username LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        if (orgId) {
            where += " AND u.organization_id = ?";
            params.push(orgId);
        }

        const [users] = await this.mysqlPool.execute(
            `SELECT u.id, u.email, u.username, u.organization_id, u.role, u.status, u.created_at,
              o.name AS organization_name, o.slug AS organization_slug
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        const [[{ total }]] = await this.mysqlPool.execute(
            `SELECT COUNT(*) AS total FROM users u ${where}`,
            [...params]
        );

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

module.exports = OrganizationService;
module.exports.normalizeOrganizationSlug = normalizeOrganizationSlug;
module.exports.PLATFORM_ORG_SLUG = PLATFORM_ORG_SLUG;
