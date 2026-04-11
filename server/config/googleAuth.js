const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const { buildBackendUrl } = require('./backendUrl.js');

/**
 * Google OAuth Configuration
 * Handles Google Sign-In authentication
 */

function configureGoogleAuth(mysqlPool, organizationService) {
    // Configure Google Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || buildBackendUrl('/auth/google/callback')
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('Google OAuth callback received for:', profile.emails[0].value);

                const email = profile.emails[0].value;
                const googleId = profile.id;
                const username = profile.displayName || email.split('@')[0];

                // Check if user exists
                const [existingUsers] = await mysqlPool.execute(
                    'SELECT * FROM users WHERE email = ? OR google_id = ?',
                    [email, googleId]
                );

                let user;

                if (existingUsers.length > 0) {
                    // User exists, update google_id if not set
                    user = existingUsers[0];

                    if (!user.google_id) {
                        await mysqlPool.execute(
                            'UPDATE users SET google_id = ? WHERE id = ?',
                            [googleId, user.id]
                        );
                        user.google_id = googleId;
                    }

                    console.log('✅ Existing user logged in:', email);
                } else {
                    // Create new user
                    const userId = uuidv4();
                    const trialStart = new Date();
                    const trialEnd = new Date(trialStart);
                    trialEnd.setDate(trialEnd.getDate() + 14);
                    const TRIAL_CREDITS = 50;

                    await mysqlPool.execute(
                        `INSERT INTO users (id, email, username, google_id, password_hash, plan_type, trial_started_at, plan_valid_until, credits_balance, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'google-oauth', 'trial', ?, ?, ?, NOW(), NOW())`,
                        [userId, email, username, googleId, trialStart, trialEnd, TRIAL_CREDITS]
                    );

                    // Create wallet for new user with trial credits
                    await mysqlPool.execute(
                        'INSERT INTO user_wallets (id, user_id, balance) VALUES (?, ?, ?)',
                        [uuidv4(), userId, TRIAL_CREDITS]
                    );

                    await mysqlPool.execute(
                        `INSERT INTO wallet_transactions (id, user_id, transaction_type, amount, balance_after, service_type, description, created_by)
                         VALUES (?, ?, 'credit', ?, ?, 'initial_credit', 'Free trial 50 credits', NULL)`,
                        [uuidv4(), userId, TRIAL_CREDITS, TRIAL_CREDITS]
                    );

                    // Create default company for new user
                    const defaultOrganization = await organizationService.getOrganization(5);
                    const org = defaultOrganization || { name: 'Ziya Voice' };
                    const companyName = `${org.name} company`;
                    const companyId = uuidv4();
                    await mysqlPool.execute(
                        'INSERT INTO companies (id, user_id, name) VALUES (?, ?, ?)',
                        [companyId, userId, companyName]
                    );
                    await mysqlPool.execute(
                        'UPDATE users SET current_company_id = ? WHERE id = ?',
                        [companyId, userId]
                    );

                    user = {
                        id: userId,
                        email,
                        username,
                        google_id: googleId,
                        plan_type: 'trial',
                        trial_started_at: trialStart,
                        plan_valid_until: trialEnd,
                        credits_balance: TRIAL_CREDITS,
                        created_at: new Date(),
                        updated_at: new Date()
                    };

                    console.log('✅ New user created via Google:', email);
                }

                return done(null, user);
            } catch (error) {
                console.error('❌ Google OAuth error:', error);
                return done(error, null);
            }
        }));

    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const [users] = await mysqlPool.execute(
                'SELECT id, email, username, google_id, current_company_id, created_at, updated_at FROM users WHERE id = ?',
                [id]
            );

            if (users.length > 0) {
                done(null, users[0]);
            } else {
                done(new Error('User not found'), null);
            }
        } catch (error) {
            done(error, null);
        }
    });

    return passport;
}

module.exports = { configureGoogleAuth };
