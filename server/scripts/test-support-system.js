/**
 * Support System - Comprehensive Test Script
 * Tests ticket creation and retrieval for all user types
 * 
 * Usage: node server/scripts/test-support-system.js
 */

const mysql = require('mysql2/promise');
const http = require('http');
require('dotenv').config();

// Test Configuration
const TEST_CONFIG = {
  backend: 'http://localhost:5000',
  db: {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '1234',
    database: process.env.MYSQL_DATABASE || 'ziya_voice_agent'
  }
};

// Test Users
const TEST_USERS = {
  user: {
    id: 'test-user-001',
    role: 'user',
    org_id: 1,
    description: 'Regular User'
  },
  org_admin: {
    id: 'test-admin-001',
    role: 'org_admin',
    org_id: 1,
    description: 'Organization Admin'
  },
  super_admin: {
    id: 'test-super-001',
    role: 'super_admin',
    org_id: 1,
    description: 'Super Admin'
  }
};

// Helper: Make HTTP request
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, TEST_CONFIG.backend);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Main Test Function
async function runTests() {
  console.log('🧪 Support System Comprehensive Test\n');
  console.log('═'.repeat(60));

  // Test 1: Database Connection
  console.log('\n📊 TEST 1: Database Connection');
  console.log('─'.repeat(60));
  try {
    const conn = await mysql.createConnection(TEST_CONFIG.db);
    const [result] = await conn.query('SELECT COUNT(*) as count FROM support_tickets');
    console.log(`✅ Database connected`);
    console.log(`   Existing tickets in DB: ${result[0].count}`);
    await conn.end();
  } catch (err) {
    console.error(`❌ Database error:`, err.message);
    return;
  }

  // Test 2: Create Tickets for Each User Type
  console.log('\n📝 TEST 2: Create Tickets\n');
  const createdTickets = {};

  for (const [userType, userInfo] of Object.entries(TEST_USERS)) {
    console.log(`  Creating ticket for: ${userInfo.description} (${userType})`);
    
    const ticketData = {
      subject: `Test Ticket - ${userType.toUpperCase()} - ${new Date().toLocaleTimeString()}`,
      category: 'Technical',
      priority: userType === 'user' ? 'Low' : 'High',
      message: `This is a test ticket created by ${userInfo.description} at ${new Date().toISOString()}`,
      created_by: userInfo.id,
      created_by_role: userInfo.role,
      organization_id: userInfo.org_id
    };

    try {
      const response = await makeRequest('POST', '/api/v2/support/tickets', ticketData);
      
      if (response.status === 200 && response.data.success) {
        createdTickets[userType] = response.data;
        console.log(`  ✅ Created: ${response.data.ticketNumber}`);
      } else {
        console.log(`  ❌ Failed: ${response.data.message}`);
        console.log(`     Status: ${response.status}`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  // Test 3: Retrieve Tickets for Each User Type
  console.log('\n🔍 TEST 3: List Tickets\n');

  for (const [userType, userInfo] of Object.entries(TEST_USERS)) {
    console.log(`  Fetching tickets for: ${userInfo.description} (${userType})`);
    
    let query = `/api/v2/support/tickets?created_by=${userInfo.id}&created_by_role=${userInfo.role}&limit=50`;
    if (userInfo.org_id) {
      query += `&organization_id=${userInfo.org_id}`;
    }

    try {
      const response = await makeRequest('GET', query);
      
      if (response.status === 200 && response.data.success) {
        const count = response.data.tickets ? response.data.tickets.length : 0;
        console.log(`  ✅ Retrieved ${count} tickets`);
        
        // Show details of created ticket
        if (createdTickets[userType]) {
          const ticketId = createdTickets[userType].ticketId;
          const ticketNum = createdTickets[userType].ticketNumber;
          const found = response.data.tickets.find(t => t.id === ticketId);
          if (found) {
            console.log(`     ✓ Own ticket "${ticketNum}" is visible`);
          } else {
            console.log(`     ✗ Own ticket "${ticketNum}" NOT visible`);
          }
        }

        if (response.data.pagination) {
          console.log(`     Pagination: page ${response.data.pagination.page}/${response.data.pagination.totalPages}, total: ${response.data.pagination.total}`);
        }
      } else {
        console.log(`  ❌ Failed: ${response.data.message}`);
        console.log(`     Status: ${response.status}`);
        console.log(`     Raw response:`, response.data);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  // Test 4: Get Ticket Detail
  console.log('\n📋 TEST 4: Get Ticket Details\n');

  for (const [userType, ticketInfo] of Object.entries(createdTickets)) {
    console.log(`  Fetching detail for: ${ticketInfo.ticketNumber}`);

    try {
      const response = await makeRequest('GET', `/api/v2/support/tickets/${ticketInfo.ticketId}`);
      
      if (response.status === 200 && response.data.success) {
        const ticket = response.data.ticket;
        console.log(`  ✅ Retrieved ticket details`);
        console.log(`     Number: ${ticket.ticket_number}`);
        console.log(`     Subject: ${ticket.subject}`);
        console.log(`     Status: ${ticket.status}`);
        console.log(`     Created by: ${ticket.created_by} (${ticket.created_by_role})`);
      } else {
        console.log(`  ❌ Failed: ${response.data.message}`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }

  // Test 5: Cross-visibility (Admin should see user tickets)
  console.log('\n👥 TEST 5: Cross-Visibility Check\n');
  
  console.log(`  Org Admin fetching tickets (should see user's ticket)`);
  try {
    const response = await makeRequest('GET', 
      `/api/v2/support/tickets?created_by=test-admin-001&created_by_role=org_admin&organization_id=1&limit=50`
    );
    
    if (response.status === 200 && response.data.success) {
      const count = response.data.tickets ? response.data.tickets.length : 0;
      console.log(`  ✅ Org admin can see ${count} tickets`);
      
      // Check if user's ticket is visible
      if (createdTickets.user) {
        const userTicketNum = createdTickets.user.ticketNumber;
        const userTicketId = createdTickets.user.ticketId;
        const isVisible = response.data.tickets.some(t => t.id === userTicketId);
        if (isVisible) {
          console.log(`     ✓ Can see user's ticket: ${userTicketNum}`);
        } else {
          console.log(`     ✗ CANNOT see user's ticket: ${userTicketNum}`);
        }
      }
    } else {
      console.log(`  ❌ Failed: ${response.data.message}`);
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test Complete\n');
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
