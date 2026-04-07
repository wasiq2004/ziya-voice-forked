/**
 * V2 API Router Scaffold
 * Structure ready for future API upgrades
 * 
 * This is the foundation for V2 features without breaking V1
 */

const express = require('express');
const router = express.Router();

// Import V2 feature routes
const supportChatRoutes = require('./supportChatRoutes');

// Mount support chat routes
router.use('/support', supportChatRoutes);

// V2 will have similar structure but with improved features
// Currently scaffolded for future development

// Status endpoint
router.get('/status', (req, res) => {
  res.json({
    version: 'v2',
    status: 'active',
    message: 'V2 API with enhanced features',
    availableEndpoints: [
      'Support Chat System (/api/v2/support/*)',
      'Real-time ticket management',
      'File attachments',
      'Advanced search & filtering'
    ]
  });
});

module.exports = { router };
