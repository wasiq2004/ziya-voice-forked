"use strict";

const bcrypt = require('bcryptjs');

class AuthService {
    constructor(mysqlPool) {
        this.mysqlPool = mysqlPool;
    }

    async authenticateUser(email, password) {
        try {
            const [rows] = await this.mysqlPool.execute(`
        SELECT u.id, u.email, u.username, u.full_name, u.profile_image,
               DATE_FORMAT(u.dob, "%Y-%m-%d") AS dob, u.gender, u.password_hash,
               u.current_company_id, u.role, u.organization_id, u.status,
               u.plan_type, u.plan_valid_until, u.trial_started_at,
               o.name AS organization_name, o.slug AS organization_slug, o.logo_url AS organization_logo_url
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        WHERE u.email = ?
      `, [email]);

            if (rows.length === 0) {
                const [adminRows] = await this.mysqlPool.execute(
                    `SELECT au.id, au.email, au.name AS username, au.password_hash, au.role, au.organization_id,
                            o.name AS organization_name, o.slug AS organization_slug, o.logo_url AS organization_logo_url
                     FROM admin_users au
                     LEFT JOIN organizations o ON au.organization_id = o.id
                     WHERE au.email = ?`,
                    [email]
                );

                if (adminRows.length === 0) {
                    return null;
                }

                const adminUser = adminRows[0];
                const isValidAdminPassword = await bcrypt.compare(password, adminUser.password_hash);

                if (!isValidAdminPassword) {
                    return null;
                }

                const { password_hash, ...adminWithoutPassword } = adminUser;
                adminWithoutPassword.status = 'active';

                try {
                    const { v4: uuidv4 } = require('uuid');
                    const logId = uuidv4();
                    await this.mysqlPool.execute(
                        'INSERT INTO admin_activity_log (id, admin_id, action_type, target_user_id, details) VALUES (?, ?, ?, ?, ?)',
                        [logId, adminUser.id, 'admin_login', null, 'Admin logged in via unified login']
                    );
                } catch (err) {
                    console.error('Error logging admin activity:', err);
                }

                return adminWithoutPassword;
            }

            const user = rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                return null;
            }

            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    async registerUser(email, username, password, organizationId = 5) {
        try {
            const [existingUsers] = await this.mysqlPool.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            if (existingUsers.length > 0) {
                throw new Error('User already exists');
            }

            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            const userId = Math.random().toString(36).substring(2, 15);

            await this.mysqlPool.execute(
                'INSERT INTO users (id, email, username, password_hash, role, organization_id) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, email, username, passwordHash, 'user', organizationId || 5]
            );

            return {
                id: userId,
                email,
                username,
                organization_id: organizationId || 5
            };
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }
}

module.exports = { AuthService };
