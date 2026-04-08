/**
 * Database Schema Fix Script
 * Ensures support_tickets table has the ticket_number column
 * 
 * Run with: node server/scripts/fix-support-tables.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSupportTables() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '1234',
    database: process.env.MYSQL_DATABASE || 'ziya_voice_agent'
  });

  try {
    console.log('🔍 Checking support_tickets table structure...\n');

    // Check if table exists
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'support_tickets'",
      [process.env.MYSQL_DATABASE || 'ziya_voice_agent']
    );

    if (tables.length === 0) {
      console.log('❌ support_tickets table does not exist. Creating...\n');
      
      await connection.query(`
        CREATE TABLE support_tickets (
          id VARCHAR(36) PRIMARY KEY,
          ticket_number VARCHAR(100) UNIQUE NOT NULL,
          subject VARCHAR(255) NOT NULL,
          category VARCHAR(100) DEFAULT 'Technical',
          priority ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
          status ENUM('Open','In Progress','Resolved','Closed') DEFAULT 'Open',
          message TEXT NOT NULL,
          created_by VARCHAR(36) NOT NULL,
          created_by_role ENUM('user','org_admin','super_admin') NOT NULL,
          organization_id INT NULL,
          assigned_to VARCHAR(36) NULL,
          escalated_to_super_admin BOOLEAN DEFAULT FALSE,
          escalated_at TIMESTAMP NULL,
          escalated_by VARCHAR(36) NULL,
          resolved_by VARCHAR(36) NULL,
          resolved_at TIMESTAMP NULL,
          is_read_by_admin BOOLEAN DEFAULT FALSE,
          unread_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_ticket_number (ticket_number),
          INDEX idx_created_by (created_by),
          INDEX idx_organization_id (organization_id),
          INDEX idx_status (status),
          INDEX idx_assigned_to (assigned_to),
          INDEX idx_escalated_to_super_admin (escalated_to_super_admin),
          INDEX idx_created_by_role (created_by_role)
        )
      `);
      console.log('✅ Created support_tickets table\n');
    } else {
      console.log('✅ support_tickets table exists\n');

      // Check for ticket_number column
      const [columns] = await connection.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'support_tickets' AND COLUMN_NAME = 'ticket_number'",
        [process.env.MYSQL_DATABASE || 'ziya_voice_agent']
      );

      if (columns.length === 0) {
        console.log('❌ ticket_number column missing. Adding...\n');
        
        try {
          await connection.query(`
            ALTER TABLE support_tickets
            ADD COLUMN ticket_number VARCHAR(100) UNIQUE NOT NULL AFTER id
          `);
          console.log('✅ Added ticket_number column\n');
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate')) {
            console.log('⚠️  Existing NULL values found. Fixing...\n');
            
            // Add column without unique constraint first
            await connection.query(`
              ALTER TABLE support_tickets
              ADD COLUMN ticket_number VARCHAR(100) AFTER id
            `).catch(() => {}); // Ignore if it already exists
            
            // Generate ticket numbers for existing records
            const [rows] = await connection.query('SELECT id FROM support_tickets WHERE ticket_number IS NULL LIMIT 100');
            const year = new Date().getFullYear();
            
            for (let i = 0; i < rows.length; i++) {
              const ticketNum = `TICKET-${year}-${String(i + 1).padStart(6, '0')}`;
              await connection.query(
                'UPDATE support_tickets SET ticket_number = ? WHERE id = ?',
                [ticketNum, rows[i].id]
              );
            }
            
            console.log(`✅ Generated ticket numbers for ${rows.length} records\n`);
          } else {
            throw err;
          }
        }
      } else {
        console.log('✅ ticket_number column already exists\n');
      }
    }

    // Create other support tables if needed
    const supportTables = [
      {
        name: 'support_ticket_messages',
        sql: `
          CREATE TABLE IF NOT EXISTS support_ticket_messages (
            id VARCHAR(36) PRIMARY KEY,
            ticket_id VARCHAR(36) NOT NULL,
            sender_id VARCHAR(36) NOT NULL,
            sender_role ENUM('user','org_admin','super_admin') NOT NULL,
            message TEXT NOT NULL,
            message_type ENUM('text','attachment_notification','system_update') DEFAULT 'text',
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
            INDEX idx_ticket_id (ticket_id),
            INDEX idx_sender_id (sender_id)
          )
        `
      },
      {
        name: 'support_ticket_attachments',
        sql: `
          CREATE TABLE IF NOT EXISTS support_ticket_attachments (
            id VARCHAR(36) PRIMARY KEY,
            ticket_id VARCHAR(36) NOT NULL,
            message_id VARCHAR(36),
            uploaded_by VARCHAR(36) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INT NOT NULL,
            mime_type VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
            INDEX idx_ticket_id (ticket_id),
            INDEX idx_uploaded_by (uploaded_by)
          )
        `
      },
      {
        name: 'support_ticket_members',
        sql: `
          CREATE TABLE IF NOT EXISTS support_ticket_members (
            id VARCHAR(36) PRIMARY KEY,
            ticket_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            user_role ENUM('user','org_admin','super_admin') NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_ticket_user (ticket_id, user_id),
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
            INDEX idx_ticket_id (ticket_id),
            INDEX idx_user_id (user_id)
          )
        `
      }
    ];

    for (const table of supportTables) {
      try {
        await connection.query(table.sql);
        console.log(`✅ Ensured ${table.name} table exists`);
      } catch (err) {
        console.warn(`⚠️  Error with ${table.name}:`, err.message);
      }
    }

    console.log('\n✅ Database schema verification complete!');
    console.log('You can now restart your server and create tickets.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

fixSupportTables();
