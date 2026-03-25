/**
 * API Architecture Documentation
 * ZIYA Voice Agent Dashboard - V1 & V2 Structure
 */

# 🏗️ API Architecture Restructure

## Overview

The API has been restructured to support:
- ✅ Health check layer
- ✅ Versioned APIs (V1 → V2)
- ✅ Role-based modular controllers
- ✅ Future upgrades without breaking existing APIs
- ✅ Clean architecture and SOLID principles

## Directory Structure

```
/server
├── /middleware
│   ├── authMiddleware.js          # Authentication verification
│   ├── roleMiddleware.js          # Role-based access control
│   └── errorHandler.js            # Global error handling
│
├── /routes
│   ├── healthRoutes.js            # Health check endpoints
│   │
│   ├── /v1                        # API V1 (Stable)
│   │   ├── index.js               # V1 router hub
│   │   ├── commonRoutes.js        # Auth, logout (no role requirement)
│   │   ├── userRoutes.js          # User-level endpoints
│   │   ├── adminRoutes.js         # Org-admin endpoints
│   │   └── superadminRoutes.js    # Super-admin endpoints
│   │
│   ├── /v2                        # API V2 (Scaffold/Future)
│   │   └── index.js               # Placeholder for V2 features
│   │
│   ├── callRoutes.js              # Call history (standalone, backward compatible)
│   ├── documentRoutes.js          # Document management (standalone)
│   ├── companyRoutes.js           # Company management (standalone)
│   └── voiceRoutes.js             # Voice management (standalone)
│
└── /controllers                   # Business logic controllers (for future use)
```

## API Endpoints Structure

### Health Check
```
GET /api/health                    # Main health endpoint
GET /api/health/live              # Kubernetes liveness probe
GET /api/health/ready             # Kubernetes readiness probe
```

### V1 Common (Authentication - No Role Required)
```
POST /api/v1/common/auth/login         # User/Admin login
POST /api/v1/common/auth/register      # User registration
POST /api/v1/common/auth/logout        # Logout
GET  /api/v1/common/auth/google        # Google OAuth (via Google Passport)
GET  /api/v1/common/auth/google/callback # Google OAuth Callback
```

### V1 User Routes
```
GET    /api/v1/user/wallet/balance/:userId
GET    /api/v1/user/wallet/transactions/:userId
GET    /api/v1/user/wallet/usage-stats/:userId
GET    /api/v1/user/wallet/pricing
POST   /api/v1/user/support/tickets
GET    /api/v1/user/support/tickets/:userId
POST   /api/v1/user/support/tickets/:ticketId/reply
```

### V1 Admin Routes (Org-Admin only - with Admin Middleware)
```
GET    /api/v1/admin/users
GET    /api/v1/admin/users/:userId
DELETE /api/v1/admin/users/:userId
PUT    /api/v1/admin/users/:userId/status
GET    /api/v1/admin/wallet/summary
POST   /api/v1/admin/wallet/add-credits
GET    /api/v1/admin/logs
GET    /api/v1/admin/stats
```

### V1 Super Admin Routes (Super-Admin only - with Super-Admin Middleware)
```
GET    /api/v1/superadmin/organizations
GET    /api/v1/superadmin/organizations/:orgId
GET    /api/v1/superadmin/org-admins
DELETE /api/v1/superadmin/org-admins/:adminId
GET    /api/v1/superadmin/users
PATCH  /api/v1/superadmin/users/:userId/status
DELETE /api/v1/superadmin/users/:userId
GET    /api/v1/superadmin/pricing
POST   /api/v1/superadmin/pricing/:serviceName
GET    /api/v1/superadmin/system-stats
```

### Backward Compatible (Existing Routes - Still Work)
```
GET    /api/calls/:userId          # From callRoutes.js
GET    /api/documents/:userId      # From documentRoutes.js
POST   /api/documents/upload
GET    /api/documents/content/:docId
DELETE /api/documents/:docId
POST   /api/companies/create       # From companyRoutes.js
GET    /api/companies/:userId
GET    /api/voices                 # From voiceRoutes.js
```

### V2 Structure (Future-Ready)
```
GET /api/v2/status  # Placeholder for future V2 features
```

## Middleware Usage

### Role-Based Protection

All role-restricted endpoints should include role information in request:
- Via `userRole` in request body
- Via `role` in query parameters
- Via `x-user-role` header

**Example:**
```json
POST /api/v1/admin/users HTTP/1.1
Content-Type: application/json

{
  "userRole": "org_admin",
  "adminId": "user-123"
}
```

### Middleware Chain
```
Request → Auth Middleware → Role Middleware → Route Handler → Response
```

## Roles & Access Control

| Role        | Access Level | Routes Available |
|-------------|-------------|------------------|
| `user`      | User        | /api/v1/user/* |
| `org_admin` | Organization Admin | /api/v1/admin/* |
| `super_admin` | System Admin | /api/v1/superadmin/*, /api/v1/admin/*, /api/v1/user/* |

## Migration Guide: Old → V1

| Old Endpoint | New V1 Endpoint | Status |
|-------------|----------------|--------|
| `/api/auth/login` | `/api/v1/common/auth/login` | ✅ Works (mapped) |
| `/api/wallet/balance/:userId` | `/api/v1/user/wallet/balance/:userId` | ✅ Works (mapped) |
| `/api/admin/users` | `/api/v1/admin/users` | ✅ Works (mapped) |
| `/api/support/tickets` | `/api/v1/user/support/tickets` | ✅ Works (mapped) |
| `/api/calls/:userId` | `/api/calls/:userId` | ✅ Still works (backward compatible) |

## Integration in server.js

```javascript
// Import versioned routes
const { initializeV1Routes } = require('./routes/v1');
const { router: v2Router } = require('./routes/v2');
const healthRoutes = require('./routes/healthRoutes');

// Initialize with services
const v1Routes = initializeV1Routes({
  authService,
  mysqlPool,
  walletService,
  campaignService,
  adminService,
  organizationService,
  companyService
});

// Mount routes
app.use('/api/health', healthRoutes);
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Router);

// Backward compatibility (map old routes to v1)
app.use('/api/auth', require('./routes/v1').commonRouter);
app.use('/api/wallet', require('./routes/v1').userRouter);
```

## Best Practices

### For Frontend Development
1. Use `/api/v1/` endpoints when available (future-proof)
2. Include `userRole` in request body or headers
3. Handle 403 Forbidden responses for unauthorized access

### For Backend Development
1. Always initialize services in controller init functions
2. Keep business logic in services, not routes
3. Add proper error handling and validation
4. Log important actions via adminService
5. Add appropriate HTTP status codes (200, 400, 403, 404, 500)

### For V2 Upgrades
1. Copy V1 route structure to V2
2. Modify endpoint behavior (don't remove V1)
3. Both versions can coexist
4. Users can choose API version in client config

## Testing Checklist

- ✅ All V1 endpoints working
- ✅ Role-based access control enforced
- ✅ Backward compatible routes still work
- ✅ Health check endpoint operational
- ✅ Error responses properly formatted
- ✅ Database constraints respected
- ✅ Session/Auth flow working

## Future Enhancements

- [ ] Add rate limiting per role
- [ ] Implement API key authentication
- [ ] Add request/response logging
- [ ] Implement caching layer
- [ ] Add pagination standards
- [ ] Document all endpoints in OpenAPI/Swagger
- [ ] Add comprehensive error codes reference

## Support & Maintenance

For questions or issues:
1. Check middleware logic in `/server/middleware/`
2. Verify service initialization in `/server/routes/v1/index.js`
3. Check backend logs for role/auth issues
4. Ensure request includes `userRole` parameter
