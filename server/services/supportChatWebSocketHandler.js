const WebSocket = require('ws');
const mysqlPool = require('../config/database');

// Store active connections: ticketId -> Set of WebSocket connections
const activeTickets = new Map();

// Store user info for each connection
const connectionMetadata = new Map();

class SupportChatWebSocketHandler {
  static initialize(server) {
    const wss = new WebSocket.Server({
      server,
      path: '/ws/support',
      perMessageDeflate: false
    });

    wss.on('connection', (ws, req) => {
      console.log('✓ Support chat WebSocket connected');

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(ws, message);
        } catch (err) {
          console.error('WebSocket message parse error:', err);
          ws.send(JSON.stringify({
            event: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
        console.log('✓ Support chat WebSocket disconnected');
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
      });
    });

    console.log('✓ Support Chat WebSocket handler initialized at /ws/support');
    return wss;
  }

  static async handleMessage(ws, message) {
    const { event, ticketId, userId, userRole, content } = message;

    switch (event) {
      case 'join_ticket':
        await this.handleJoinTicket(ws, { ticketId, userId, userRole });
        break;

      case 'send_message':
        await this.handleSendMessage(ws, { ticketId, userId, userRole, content });
        break;

      case 'typing':
        await this.handleTyping(ws, { ticketId, userId, userRole });
        break;

      case 'leave_ticket':
        this.handleLeaveTicket(ws, { ticketId, userId });
        break;

      case 'mark_read':
        await this.handleMarkRead(ws, { ticketId, userId });
        break;

      default:
        ws.send(JSON.stringify({
          event: 'error',
          message: `Unknown event: ${event}`
        }));
    }
  }

  static async handleJoinTicket(ws, data) {
    const { ticketId, userId, userRole } = data;

    // Store connection metadata
    connectionMetadata.set(ws, { ticketId, userId, userRole });

    // Add WebSocket to ticket's active connections
    if (!activeTickets.has(ticketId)) {
      activeTickets.set(ticketId, new Set());
    }
    activeTickets.get(ticketId).add(ws);

    console.log(`✓ User ${userId} joined ticket ${ticketId}`);

    // Send confirmation to client
    ws.send(JSON.stringify({
      event: 'joined_ticket',
      ticketId,
      message: `Connected to ticket ${ticketId}`,
      timestamp: new Date().toISOString()
    }));

    // Notify other users
    this.broadcastToTicket(ticketId, {
      event: 'user_joined',
      userId,
      userRole,
      timestamp: new Date().toISOString()
    }, ws);

    // Send current online users to new client
    const onlineUsers = await this.getTicketUsers(ticketId);
    ws.send(JSON.stringify({
      event: 'online_users',
      users: onlineUsers,
      ticketId
    }));
  }

  static async handleSendMessage(ws, data) {
    const { ticketId, userId, userRole, content } = data;
    const metadata = connectionMetadata.get(ws);

    if (!metadata || metadata.ticketId !== ticketId) {
      ws.send(JSON.stringify({
        event: 'error',
        message: 'Not connected to this ticket'
      }));
      return;
    }

    try {
      // Store message in database
      const messageId = require('crypto').randomBytes(8).toString('hex');
      await mysqlPool.execute(
        'INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?, ?)',
        [messageId, ticketId, userId, userRole, content]
      );

      // Update ticket timestamp
      await mysqlPool.execute(
        'UPDATE support_tickets SET updated_at = NOW() WHERE id = ?',
        [ticketId]
      );

      // Broadcast message to all connected users
      this.broadcastToTicket(ticketId, {
        event: 'new_message',
        messageId,
        ticketId,
        senderId: userId,
        senderRole: userRole,
        content,
        timestamp: new Date().toISOString()
      });

      console.log(`✓ Message sent to ticket ${ticketId} by ${userId}`);

      // Send delivery confirmation
      ws.send(JSON.stringify({
        event: 'message_sent',
        messageId,
        status: 'delivered'
      }));
    } catch (err) {
      console.error('Send message error:', err);
      ws.send(JSON.stringify({
        event: 'error',
        message: 'Failed to send message'
      }));
    }
  }

  static async handleTyping(ws, data) {
    const { ticketId, userId, userRole } = data;
    const metadata = connectionMetadata.get(ws);

    if (!metadata || metadata.ticketId !== ticketId) {
      return;
    }

    // Notify others that user is typing
    this.broadcastToTicket(ticketId, {
      event: 'user_typing',
      userId,
      userRole,
      ticketId
    }, ws);
  }

  static handleLeaveTicket(ws, data) {
    const { ticketId, userId } = data;
    const metadata = connectionMetadata.get(ws);

    if (!metadata) {
      return;
    }

    // Remove connection
    const tickets = activeTickets.get(ticketId);
    if (tickets) {
      tickets.delete(ws);
      if (tickets.size === 0) {
        activeTickets.delete(ticketId);
      }
    }

    connectionMetadata.delete(ws);

    // Notify others
    this.broadcastToTicket(ticketId, {
      event: 'user_left',
      userId,
      ticketId,
      timestamp: new Date().toISOString()
    });

    console.log(`✓ User ${userId} left ticket ${ticketId}`);
  }

  static async handleMarkRead(ws, data) {
    const { ticketId, userId } = data;

    try {
      // Mark all messages in ticket as read for this user
      await mysqlPool.execute(
        'UPDATE support_ticket_messages SET is_read = TRUE WHERE ticket_id = ? AND is_read = FALSE',
        [ticketId]
      );

      ws.send(JSON.stringify({
        event: 'marked_read',
        ticketId,
        status: 'success'
      }));

      // Notify others
      this.broadcastToTicket(ticketId, {
        event: 'ticket_read',
        userId,
        ticketId
      }, ws);
    } catch (err) {
      console.error('Mark read error:', err);
    }
  }

  static handleDisconnect(ws) {
    const metadata = connectionMetadata.get(ws);
    if (metadata) {
      const { ticketId, userId } = metadata;

      // Remove from active connections
      const tickets = activeTickets.get(ticketId);
      if (tickets) {
        tickets.delete(ws);
        if (tickets.size === 0) {
          activeTickets.delete(ticketId);
        }
      }

      // Notify remaining users
      this.broadcastToTicket(ticketId, {
        event: 'user_disconnected',
        userId,
        ticketId
      });

      connectionMetadata.delete(ws);
    }
  }

  static broadcastToTicket(ticketId, message, excludeWs = null) {
    const tickets = activeTickets.get(ticketId);
    if (!tickets) return;

    const messageStr = JSON.stringify(message);
    tickets.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  static async getTicketUsers(ticketId) {
    try {
      const tickets = activeTickets.get(ticketId);
      const users = [];

      if (tickets) {
        tickets.forEach((ws) => {
          const metadata = connectionMetadata.get(ws);
          if (metadata) {
            users.push({
              userId: metadata.userId,
              userRole: metadata.userRole,
              status: 'online'
            });
          }
        });
      }

      return users;
    } catch (err) {
      console.error('Get ticket users error:', err);
      return [];
    }
  }

  static getActiveTicketCount() {
    return activeTickets.size;
  }

  static getActiveConnectionCount() {
    return connectionMetadata.size;
  }
}

module.exports = SupportChatWebSocketHandler;
