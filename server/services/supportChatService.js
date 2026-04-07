const mysqlPool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Support ticket numbers need to be globally unique because the formatted
// value does not include organization context.
let nextSupportTicketNumber = null;

const generateTicketNumber = async () => {
  if (nextSupportTicketNumber === null) {
    try {
      const [rows] = await mysqlPool.execute(
        'SELECT MAX(CAST(SUBSTRING_INDEX(ticket_number, "-", -1) AS UNSIGNED)) as max_num FROM support_tickets'
      );
      const maxNum = rows[0]?.max_num || 0;
      nextSupportTicketNumber = maxNum + 1;
    } catch (err) {
      nextSupportTicketNumber = 1;
    }
  }

  const nextNum = nextSupportTicketNumber;
  nextSupportTicketNumber += 1;
  const year = new Date().getFullYear();
  return `TICKET-${year}-${String(nextNum).padStart(6, '0')}`;
};

const normalizePagination = (page, limit) => {
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.max(parseInt(limit, 10) || 20, 1);

  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit
  };
};

// Create a new support ticket
const createTicket = async (ticketData) => {
  const { subject, category, priority, message, created_by, created_by_role, organization_id } = ticketData;
  const ticketId = require('crypto').randomBytes(8).toString('hex');
  const ticketNumber = await generateTicketNumber(organization_id);

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    // Insert ticket
    await connection.execute(
      `INSERT INTO support_tickets (id, ticket_number, subject, category, priority, message, created_by, created_by_role, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, ticketNumber, subject, category || 'Technical', priority || 'Medium', message, created_by, created_by_role, organization_id || null]
    );

    // Add ticket creator as a member
    const memberId = require('crypto').randomBytes(8).toString('hex');
    await connection.execute(
      'INSERT INTO support_ticket_members (id, ticket_id, user_id, user_role) VALUES (?, ?, ?, ?)',
      [memberId, ticketId, created_by, created_by_role]
    );

    // Insert initial message
    const messageId = require('crypto').randomBytes(8).toString('hex');
    await connection.execute(
      'INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?, ?)',
      [messageId, ticketId, created_by, created_by_role, message]
    );

    await connection.commit();

    return { success: true, ticketId, ticketNumber };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.release();
  }
};

// Get list of tickets with filtering and searching
const getTickets = async (filterData) => {
  const { created_by, created_by_role, organization_id, status, priority, page = 1, limit = 20, search = '' } = filterData;
  const pagination = normalizePagination(page, limit);
  let where = [];
  let params = [];

  if (created_by_role === 'user' && created_by) {
    where.push('(t.created_by = ? OR t.id IN (SELECT ticket_id FROM support_ticket_members WHERE user_id = ?))');
    params.push(created_by, created_by);
  } else if (created_by_role === 'org_admin' && organization_id) {
    where.push('t.organization_id = ?');
    params.push(parseInt(organization_id));
  } else if (created_by_role === 'super_admin') {
    where.push('t.escalated_to_super_admin = TRUE');
  }

  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }

  if (priority) {
    where.push('t.priority = ?');
    params.push(priority);
  }

  if (search) {
    where.push('(t.ticket_number LIKE ? OR t.subject LIKE ? OR t.message LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  
  // Build final parameters array for both queries
  const [tickets] = await mysqlPool.execute(
    `SELECT t.*,
            (SELECT COUNT(*) FROM support_ticket_messages WHERE ticket_id = t.id AND is_read = FALSE) as unread_messages
     FROM support_tickets t
     ${whereClause}
     ORDER BY t.updated_at DESC
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params
  );

  const [[{ total }]] = await mysqlPool.execute(
    `SELECT COUNT(*) as total FROM support_tickets t ${whereClause}`,
    params
  );

  return {
    tickets,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    }
  };
};

// Get ticket detail with all messages and attachments
const getTicketDetail = async (ticketId, viewerData = {}) => {
  const { created_by, created_by_role, organization_id } = viewerData;
  let where = ['t.id = ?'];
  let params = [ticketId];

  if (created_by_role === 'user' && created_by) {
    where.push('(t.created_by = ? OR t.id IN (SELECT ticket_id FROM support_ticket_members WHERE user_id = ?))');
    params.push(created_by, created_by);
  } else if (created_by_role === 'org_admin' && organization_id) {
    where.push('t.organization_id = ?');
    params.push(parseInt(organization_id));
  } else if (created_by_role === 'super_admin') {
    where.push('t.escalated_to_super_admin = TRUE');
  }

  const [tickets] = await mysqlPool.execute(
    `SELECT t.* FROM support_tickets t WHERE ${where.join(' AND ')}`,
    params
  );

  if (tickets.length === 0) {
    throw new Error('Ticket not found');
  }

  // Get all messages
  const [messages] = await mysqlPool.execute(
    `SELECT m.* FROM support_ticket_messages m
     WHERE m.ticket_id = ?
     ORDER BY m.created_at ASC`,
    [ticketId]
  );

  // Get members
  const [members] = await mysqlPool.execute(
    `SELECT m.* FROM support_ticket_members m
     WHERE m.ticket_id = ?`,
    [ticketId]
  );

  // Get attachments
  const [attachments] = await mysqlPool.execute(
    'SELECT * FROM support_ticket_attachments WHERE ticket_id = ? ORDER BY created_at DESC',
    [ticketId]
  );

  // Mark messages as read
  await mysqlPool.execute(
    'UPDATE support_ticket_messages SET is_read = TRUE WHERE ticket_id = ? AND is_read = FALSE',
    [ticketId]
  );

  return {
    ticket: tickets[0],
    messages,
    members,
    attachments
  };
};

// Add a message to a ticket
const addMessage = async (ticketId, messageData) => {
  const { sender_id, sender_role, message } = messageData;
  const messageId = require('crypto').randomBytes(8).toString('hex');

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    // Add message
    await connection.execute(
      'INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?, ?)',
      [messageId, ticketId, sender_id, sender_role, message]
    );

    // Update ticket timestamp
    await connection.execute(
      'UPDATE support_tickets SET updated_at = NOW() WHERE id = ?',
      [ticketId]
    );

    // Add sender as member if not already present (for admins replying)
    await connection.execute(
      `INSERT IGNORE INTO support_ticket_members (id, ticket_id, user_id, user_role)
       VALUES (?, ?, ?, ?)`,
      [require('crypto').randomBytes(8).toString('hex'), ticketId, sender_id, sender_role]
    );

    await connection.commit();

    return { success: true, messageId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.release();
  }
};

// Update ticket fields
const updateTicket = async (ticketId, ticketData) => {
  const {
    subject,
    category,
    priority,
    status,
    message,
    assigned_to = null,
    updated_by = null,
    updated_by_role = 'org_admin'
  } = ticketData;

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE support_tickets
       SET subject = ?, category = ?, priority = ?, status = ?, message = ?, assigned_to = ?, updated_at = NOW()
       WHERE id = ?`,
      [subject, category, priority, status, message, assigned_to, ticketId]
    );

    if (assigned_to) {
      await connection.execute(
        `INSERT IGNORE INTO support_ticket_members (id, ticket_id, user_id, user_role)
         VALUES (?, ?, ?, ?)`,
        [require('crypto').randomBytes(8).toString('hex'), ticketId, assigned_to, 'org_admin']
      );
    }

    const auditMessage = require('crypto').randomBytes(8).toString('hex');
    await connection.execute(
      'INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, message_type) VALUES (?, ?, ?, ?, ?, ?)',
      [auditMessage, ticketId, updated_by || 'system', updated_by_role, 'Ticket details updated', 'system_update']
    );

    await connection.commit();
    return { success: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.release();
  }
};

// Upload attachment to ticket
const uploadAttachment = async (ticketId, fileData) => {
  const { uploaded_by, uploaded_by_role = 'user', file_name, file_path, file_size, mime_type } = fileData;
  const attachmentId = require('crypto').randomBytes(8).toString('hex');
  const messageId = require('crypto').randomBytes(8).toString('hex');

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    // Add attachment
    await connection.execute(
      `INSERT INTO support_ticket_attachments (id, ticket_id, message_id, uploaded_by, file_name, file_path, file_size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [attachmentId, ticketId, messageId, uploaded_by, file_name, file_path, file_size, mime_type]
    );

    // Create a notification message
    await connection.execute(
      'INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, message_type) VALUES (?, ?, ?, ?, ?, ?)',
      [messageId, ticketId, uploaded_by, uploaded_by_role, `Attachment: ${file_name}`, 'attachment_notification']
    );

    // Update ticket
    await connection.execute(
      'UPDATE support_tickets SET updated_at = NOW() WHERE id = ?',
      [ticketId]
    );

    await connection.commit();

    return { success: true, attachmentId, messageId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.release();
  }
};

// Update ticket status
const updateTicketStatus = async (ticketId, status, resolved_by = null) => {
  const updates = ['status = ?'];
  const params = [status];

  if (status === 'Closed' || status === 'Resolved') {
    updates.push('resolved_by = ?');
    updates.push('resolved_at = NOW()');
    params.push(resolved_by);
  }

  params.push(ticketId);

  await mysqlPool.execute(
    `UPDATE support_tickets SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
    params
  );

  return { success: true, message: `Ticket status updated to ${status}` };
};

// Escalate ticket to super admin queue
const escalateTicketToSuperAdmin = async (ticketId, escalated_by) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE support_tickets
       SET escalated_to_super_admin = TRUE,
           escalated_at = NOW(),
           escalated_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [escalated_by, ticketId]
    );

    const messageId = require('crypto').randomBytes(8).toString('hex');
    await connection.execute(
      'INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, message_type) VALUES (?, ?, ?, ?, ?, ?)',
      [messageId, ticketId, escalated_by, 'org_admin', 'Ticket escalated to super admin', 'system_update']
    );

    await connection.commit();
    return { success: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.release();
  }
};

// Assign ticket to admin
const assignTicket = async (ticketId, assigned_to, assigned_by) => {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE support_tickets SET assigned_to = ?, is_read_by_admin = TRUE, updated_at = NOW() WHERE id = ?',
      [assigned_to, ticketId]
    );

    // Add assignee as member
    await connection.execute(
      `INSERT IGNORE INTO support_ticket_members (id, ticket_id, user_id, user_role)
       VALUES (?, ?, ?, ?)`,
      [require('crypto').randomBytes(8).toString('hex'), ticketId, assigned_to, 'org_admin']
    );

    // Log assignment
    const logMessageId = require('crypto').randomBytes(8).toString('hex');
    await connection.execute(
      'INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, message_type) VALUES (?, ?, ?, ?, ?, ?)',
      [logMessageId, ticketId, assigned_by, 'org_admin', `Ticket assigned to admin`, 'attachment_notification']
    );

    await connection.commit();

    return { success: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.release();
  }
};

// Get support statistics
const getSupportStats = async (organization_id, viewer_role = null) => {
  let whereParts = [];
  let params = [];

  if (viewer_role === 'org_admin' && organization_id) {
    whereParts.push('organization_id = ?');
    params.push(parseInt(organization_id));
  } else if (viewer_role === 'super_admin') {
    whereParts.push('escalated_to_super_admin = TRUE');
  } else if (organization_id) {
    whereParts.push('organization_id = ?');
    params.push(parseInt(organization_id));
  }

  const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [stats] = await mysqlPool.execute(
    `SELECT
       COUNT(*) as total,
       SUM(status = 'Open') as open_count,
       SUM(status = 'In Progress') as in_progress_count,
       SUM(status = 'Resolved') as resolved_count,
       SUM(status = 'Closed') as closed_count
     FROM support_tickets ${where}`,
    params
  );

  return stats[0];
};

// Search tickets for admin dashboard
const searchTickets = async (searchParams) => {
  const { ticket_number, status, priority, assigned_to, date_from, date_to, organization_id, page = 1, limit = 20 } = searchParams;
  const pagination = normalizePagination(page, limit);
  let where = [];
  let params = [];

  if (ticket_number) {
    where.push('t.ticket_number LIKE ?');
    params.push(`%${ticket_number}%`);
  }

  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }

  if (priority) {
    where.push('t.priority = ?');
    params.push(priority);
  }

  if (assigned_to) {
    where.push('t.assigned_to = ?');
    params.push(assigned_to);
  }

  if (organization_id) {
    where.push('t.organization_id = ?');
    params.push(parseInt(organization_id));
  }

  if (date_from) {
    where.push('DATE(t.created_at) >= ?');
    params.push(date_from);
  }

  if (date_to) {
    where.push('DATE(t.created_at) <= ?');
    params.push(date_to);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [tickets] = await mysqlPool.execute(
    `SELECT t.*, 
            (SELECT COUNT(*) FROM support_ticket_messages WHERE ticket_id = t.id) as message_count,
            (SELECT COUNT(*) FROM support_ticket_attachments WHERE ticket_id = t.id) as attachment_count
     FROM support_tickets t
     ${whereClause}
     ORDER BY t.updated_at DESC
     LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
    params
  );

  const [[{ total }]] = await mysqlPool.execute(
    `SELECT COUNT(*) as total FROM support_tickets t ${whereClause}`,
    params
  );

  return {
    tickets,
    pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) }
  };
};

module.exports = {
  generateTicketNumber,
  createTicket,
  getTickets,
  getTicketDetail,
  addMessage,
  updateTicket,
  uploadAttachment,
  updateTicketStatus,
  escalateTicketToSuperAdmin,
  assignTicket,
  getSupportStats,
  searchTickets
};
