const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supportChatService = require('../../services/supportChatService');

const normalizeSupportRole = (role) => {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'org_admin' || role === 'admin' || role === 'billing') return 'org_admin';
  return 'user';
};

// Configure file upload for support attachments
const supportUploadDir = path.join(__dirname, '../uploads/support-tickets');
if (!fs.existsSync(supportUploadDir)) {
  fs.mkdirSync(supportUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ticketDir = path.join(supportUploadDir, req.params.ticketId);
    if (!fs.existsSync(ticketDir)) {
      fs.mkdirSync(ticketDir, { recursive: true });
    }
    cb(null, ticketDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// POST /api/v2/support/tickets - Create new ticket
router.post('/tickets', async (req, res) => {
  try {
    const { subject, category, priority, message, created_by, created_by_role, organization_id } = req.body;
    const normalizedRole = normalizeSupportRole(created_by_role);

    if (!subject || !message || !created_by || !normalizedRole) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, message, created_by, created_by_role'
      });
    }

    const result = await supportChatService.createTicket({
      subject,
      category,
      priority,
      message,
      created_by,
      created_by_role: normalizedRole,
      organization_id
    });

    console.log(`✓ Support ticket created: ${result.ticketNumber} (${result.ticketId})`);

    res.json({
      success: true,
      ticketId: result.ticketId,
      ticketNumber: result.ticketNumber,
      message: `Ticket ${result.ticketNumber} created successfully`
    });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v2/support/tickets - List tickets with filters
router.get('/tickets', async (req, res) => {
  try {
    const { created_by, created_by_role, organization_id, status, priority, page, limit, search } = req.query;
    const normalizedRole = normalizeSupportRole(created_by_role);

    const result = await supportChatService.getTickets({
      created_by,
      created_by_role: normalizedRole,
      organization_id: organization_id ? parseInt(organization_id) : undefined,
      status,
      priority,
      page: page || 1,
      limit: limit || 20,
      search: search || ''
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('List tickets error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v2/support/tickets/:ticketId - Get ticket detail with messages
router.get('/tickets/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { created_by, created_by_role, organization_id } = req.query;
    const normalizedRole = normalizeSupportRole(created_by_role);

    const result = await supportChatService.getTicketDetail(ticketId, {
      created_by,
      created_by_role: normalizedRole,
      organization_id: organization_id ? parseInt(organization_id) : undefined
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Get ticket error:', err);
    if (err.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v2/support/tickets/:ticketId/messages - Add message to ticket
router.post('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { sender_id, sender_role, message } = req.body;
    const normalizedRole = normalizeSupportRole(sender_role);

    if (!sender_id || !normalizedRole || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sender_id, sender_role, message'
      });
    }

    const result = await supportChatService.addMessage(ticketId, {
      sender_id,
      sender_role: normalizedRole,
      message
    });

    console.log(`✓ Message added to ticket: ${ticketId}`);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Add message error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v2/support/tickets/:ticketId - Update ticket fields
router.patch('/tickets/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const {
      subject,
      category,
      priority,
      status,
      message,
      assigned_to,
      updated_by,
      updated_by_role
    } = req.body;
    const normalizedUpdatedByRole = normalizeSupportRole(updated_by_role);

    if (!subject || !category || !priority || !status || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, category, priority, status, message'
      });
    }

    if (!['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    if (!['Low', 'Medium', 'High', 'Urgent'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority value'
      });
    }

    await supportChatService.updateTicket(ticketId, {
      subject,
      category,
      priority,
      status,
      message,
      assigned_to,
      updated_by,
      updated_by_role: normalizedUpdatedByRole
    });

    res.json({ success: true, message: 'Ticket updated successfully' });
  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v2/support/tickets/:ticketId/escalate - Escalate ticket to super admin
router.patch('/tickets/:ticketId/escalate', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { escalated_by } = req.body;

    if (!escalated_by) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: escalated_by'
      });
    }

    await supportChatService.escalateTicketToSuperAdmin(ticketId, escalated_by);

    res.json({ success: true, message: 'Ticket pushed to super admin successfully' });
  } catch (err) {
    console.error('Escalate ticket error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v2/support/tickets/:ticketId/attachments - Upload file attachment
router.post('/tickets/:ticketId/attachments', uploadMiddleware.single('file'), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { uploaded_by, uploaded_by_role } = req.body;
    const normalizedUploadedByRole = normalizeSupportRole(uploaded_by_role);

    if (!req.file || !uploaded_by) {
      return res.status(400).json({
        success: false,
        message: 'Missing file or uploaded_by field'
      });
    }

    const file_path = `/uploads/support-tickets/${ticketId}/${req.file.filename}`;

    const result = await supportChatService.uploadAttachment(ticketId, {
      uploaded_by,
      uploaded_by_role: normalizedUploadedByRole,
      file_name: req.file.originalname,
      file_path,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });

    console.log(`✓ Attachment uploaded to ticket: ${ticketId} - ${req.file.originalname}`);

    res.json({
      success: true,
      ...result,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        path: file_path
      }
    });
  } catch (err) {
    console.error('Upload attachment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v2/support/tickets/:ticketId/status - Update ticket status
router.patch('/tickets/:ticketId/status', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, resolved_by } = req.body;

    if (!status || !['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: Open, In Progress, Resolved, or Closed'
      });
    }

    const result = await supportChatService.updateTicketStatus(ticketId, status, resolved_by);

    console.log(`✓ Ticket ${ticketId} status updated to: ${status}`);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v2/support/tickets/:ticketId/assign - Assign ticket to admin
router.patch('/tickets/:ticketId/assign', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assigned_to, assigned_by } = req.body;

    if (!assigned_to || !assigned_by) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: assigned_to, assigned_by'
      });
    }

    await supportChatService.assignTicket(ticketId, assigned_to, assigned_by);

    console.log(`✓ Ticket ${ticketId} assigned to: ${assigned_to}`);

    res.json({ success: true, message: 'Ticket assigned successfully' });
  } catch (err) {
    console.error('Assign ticket error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v2/support/stats - Get support statistics
router.get('/stats', async (req, res) => {
  try {
    const { organization_id, viewer_role } = req.query;
    const normalizedViewerRole = normalizeSupportRole(viewer_role);

    const stats = await supportChatService.getSupportStats(organization_id, normalizedViewerRole);

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Support stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v2/support/search - Advanced search for admin dashboard
router.get('/search', async (req, res) => {
  try {
    const searchParams = req.query;

    const result = await supportChatService.searchTickets(searchParams);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Support search error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v2/support/tickets/:ticketId/attachments/:attachmentId/download - Download attachment
router.get('/tickets/:ticketId/attachments/:attachmentId/download', async (req, res) => {
  try {
    const { ticketId, attachmentId } = req.params;
    const { created_by, created_by_role, organization_id } = req.query;
    const normalizedRole = normalizeSupportRole(created_by_role);
    const mysqlPool = require('../../config/database');

    const [tickets] = await mysqlPool.execute(
      `SELECT t.* FROM support_tickets t
       WHERE t.id = ?
         AND (
           (? = 'super_admin' AND t.escalated_to_super_admin = TRUE)
           OR (? = 'org_admin' AND t.organization_id = ?)
           OR (? = 'user' AND (t.created_by = ? OR t.id IN (SELECT ticket_id FROM support_ticket_members WHERE user_id = ?)))
         )`,
      [
        ticketId,
        normalizedRole,
        normalizedRole,
        organization_id ? parseInt(organization_id) : null,
        normalizedRole,
        created_by || '',
        created_by || ''
      ]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const [attachments] = await mysqlPool.execute(
      'SELECT * FROM support_ticket_attachments WHERE id = ? AND ticket_id = ?',
      [attachmentId, ticketId]
    );

    if (attachments.length === 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const attachment = attachments[0];
    const normalizedRelativePath = String(attachment.file_path || '').replace(/^[\\/]+/, '');
    const filePath = path.resolve(__dirname, '..', normalizedRelativePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.download(filePath, attachment.file_name);
  } catch (err) {
    console.error('Download attachment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
