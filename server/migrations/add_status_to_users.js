/**
 * Migration: add_status_to_users
 * Adds the `status` column to the `users` table if it doesn't already exist.
 * Safe to run multiple times (idempotent).
 */

async function runMigration(mysqlPool) {
    try {
        // Check if the column already exists
        const [columns] = await mysqlPool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'status'
    `);

        if (columns.length > 0) {
            console.log("✅ Migration [add_status_to_users]: Column 'status' already exists. Skipping.");
            return;
        }

        // Add the column
        await mysqlPool.execute(`
      ALTER TABLE users
      ADD COLUMN status ENUM('active', 'inactive', 'locked') NOT NULL DEFAULT 'active'
    `);

        console.log("✅ Migration [add_status_to_users]: Column 'status' added successfully.");
    } catch (error) {
        console.error('❌ Migration [add_status_to_users] failed:', error.message);
        throw error;
    }
}

module.exports = runMigration;
