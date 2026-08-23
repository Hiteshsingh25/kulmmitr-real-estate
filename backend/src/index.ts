import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { WorkflowProcessor } from './services/workflowProcessor';
import { whatsappService } from './services/whatsappService';
import { hashPassword, verifyPassword } from './utils/crypto';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Extend Express Request type globally
declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      workspaceId?: string;
      user?: any; // User object resolved from session
      sessionToken?: string;
    }
  }
}

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} | User: ${req.user?.email || 'Guest'} | Org: ${req.header('X-Org-ID') || 'None'} | Workspace: ${req.header('X-Workspace-ID') || 'None'}`);
  next();
});

// ----------------------------------------------------
// Validation Schemas
// ----------------------------------------------------

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(6, "Password must be at least 6 characters")
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

const organizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional()
});

const workspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  securityType: z.enum(['PRIVATE', 'MEMBERS', 'PUBLIC']).default('PRIVATE'),
  password: z.string().min(4, "Password must be at least 4 characters").optional().or(z.literal(''))
});

const workspacePasswordSchema = z.object({
  action: z.enum(['ENABLE', 'DISABLE', 'UPDATE']),
  password: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional()
});

const teamInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER')
});

const teamRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
});

const teamStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INVITED'])
});

const workflowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "name is required").max(100),
  status: z.enum(['ACTIVE', 'DRAFT', 'INACTIVE']),
  definition: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any())
  })
});

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().min(1, "Phone is required"),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'LOST']),
  source: z.string().default('MANUAL')
});

const webhookSchema = z.object({
  contactId: z.string().min(1, "contactId (phone number) is required"),
  messageText: z.string().min(1, "messageText is required")
});

const billingUpgradeSchema = z.object({
  planName: z.enum(['Free Plan', 'Pro Plan', 'Business Plan'])
});

const planAdminSchema = z.object({
  name: z.string().min(1, "Plan name required"),
  price: z.number().min(0),
  maxWorkspaces: z.number().min(1),
  maxLeads: z.number().min(10),
  maxExecutions: z.number().min(100)
});

// ----------------------------------------------------
// Security & Authorization Middlewares
// ----------------------------------------------------

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Session token required.' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Unauthorized: Session invalid or expired.' });
    }

    req.user = session.user;
    req.sessionToken = token;
    next();
  } catch (error) {
    console.error('requireAuth middleware error:', error);
    return res.status(500).json({ error: 'Internal auth middleware error.' });
  }
}

const ROLE_RANKS: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1
};

function requireOrgAccess(minRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    // SUPER_ADMIN has global access bypass
    if (req.user.role === 'SUPER_ADMIN') {
      req.orgId = req.header('X-Org-ID') || req.params.orgId;
      return next();
    }

    const orgId = req.header('X-Org-ID') || req.params.orgId;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing organization context header (X-Org-ID).' });
    }
    req.orgId = orgId.trim();

    try {
      const member = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: req.orgId,
            userId: req.user.id
          }
        },
        include: { organization: true }
      });

      if (!member || member.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Access Denied: You do not belong to this organization.' });
      }

      if (member.organization.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Access Denied: This organization has been suspended.' });
      }

      const userRank = ROLE_RANKS[member.role] || 0;
      const requiredRank = ROLE_RANKS[minRole];

      if (userRank < requiredRank) {
        return res.status(403).json({ error: `Access Denied: ${minRole} role rank or higher is required.` });
      }

      next();
    } catch (error) {
      console.error('requireOrgAccess middleware error:', error);
      return res.status(500).json({ error: 'Internal authorization error.' });
    }
  };
}

function requireWorkspaceAccess(minRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    // SUPER_ADMIN has global access bypass
    if (req.user.role === 'SUPER_ADMIN') {
      req.workspaceId = req.header('X-Workspace-ID') || req.params.workspaceId;
      req.orgId = req.header('X-Org-ID') || req.params.orgId;
      return next();
    }

    const workspaceId = req.header('X-Workspace-ID') || req.params.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspace context header (X-Workspace-ID).' });
    }
    req.workspaceId = workspaceId.trim();

    const orgId = req.header('X-Org-ID') || req.params.orgId;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing organization context header (X-Org-ID).' });
    }
    req.orgId = orgId.trim();

    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.workspaceId }
      });

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found.' });
      }

      if (workspace.orgId !== req.orgId) {
        return res.status(403).json({ error: 'Access Denied: Workspace does not belong to this organization.' });
      }

      // Check security type
      if (workspace.securityType === 'PUBLIC') {
        // Public workspaces can enforce optional passcodes
        if (workspace.passwordHash && workspace.passwordSalt) {
          const workspacePassword = req.header('X-Workspace-Password');
          
          if (!workspacePassword) {
            return res.status(401).json({ 
              error: 'Workspace is passcode protected. Password is required.',
              isLocked: true 
            });
          }

          const isValid = verifyPassword(workspacePassword, workspace.passwordHash, workspace.passwordSalt);
          if (!isValid) {
            return res.status(401).json({ 
              error: 'Invalid workspace passcode.',
              isLocked: true 
            });
          }
        }
        return next();
      }

      // Enforce organization membership
      const member = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: req.orgId,
            userId: req.user.id
          }
        }
      });

      if (!member || member.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Access Denied: You do not belong to this organization.' });
      }

      const userRank = ROLE_RANKS[member.role] || 0;
      const requiredRank = ROLE_RANKS[minRole];

      if (userRank < requiredRank) {
        return res.status(403).json({ error: `Access Denied: Workspace role ${minRole} or higher required.` });
      }

      next();
    } catch (error) {
      console.error('requireWorkspaceAccess middleware error:', error);
      return res.status(500).json({ error: 'Internal workspace authorization error.' });
    }
  };
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access Denied: Super Admin permissions required.' });
  }
  next();
}

// Helper to log user activities (Audit Logging)
async function writeAuditLog(orgId: string, workspaceId: string | null, userId: string | null, userEmail: string | null, action: string, resource: string, details?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId,
        workspaceId,
        userId,
        userEmail,
        action,
        resource,
        details
      }
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error);
  }
}

// ----------------------------------------------------
// Authentication Endpoints
// ----------------------------------------------------

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const pwCreds = hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: pwCreds.hash,
        passwordSalt: pwCreds.salt
      }
    });

    const freePlan = await prisma.plan.findUnique({ where: { name: 'Free Plan' } });

    // Auto-create Organization, Workspace, and set OWNER membership
    const org = await prisma.organization.create({
      data: {
        name: `${body.name}'s Company`,
        description: 'Default organization created upon signup.',
        planId: freePlan?.id || null,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
            status: 'ACTIVE'
          }
        },
        workspaces: {
          create: {
            name: 'Default Workspace',
            description: 'My primary workspace for followups.',
            securityType: 'PRIVATE'
          }
        }
      },
      include: {
        workspaces: true
      }
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    await writeAuditLog(org.id, null, user.id, user.email, 'ORGANIZATION_CREATED', 'Organization', `Signed up and created default organization: ${org.name}`);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      defaultOrgId: org.id,
      defaultWorkspaceId: org.workspaces[0].id
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isValid = verifyPassword(body.password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    // Check memberships
    let defaultOrgId: string | null = null;
    let defaultWorkspaceId: string | null = null;

    if (user.role === 'SUPER_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({
        include: { workspaces: true }
      });
      defaultOrgId = firstOrg?.id || null;
      defaultWorkspaceId = firstOrg?.workspaces[0]?.id || null;
    } else {
      const member = await prisma.organizationMember.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        include: {
          organization: {
            include: { workspaces: true }
          }
        }
      });
      defaultOrgId = member?.orgId || null;
      defaultWorkspaceId = member?.organization.workspaces[0]?.id || null;
    }

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      defaultOrgId,
      defaultWorkspaceId
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.session.delete({
      where: { token: req.sessionToken }
    });
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  return res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role
  });
});

// ----------------------------------------------------
// Organization CRUD Endpoints
// ----------------------------------------------------

app.get('/api/organizations', requireAuth, async (req: Request, res: Response) => {
  try {
    let orgs;
    if (req.user.role === 'SUPER_ADMIN') {
      orgs = await prisma.organization.findMany({
        orderBy: { name: 'asc' }
      });
    } else {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        include: { organization: true }
      });
      orgs = memberships.map(m => m.organization);
    }

    return res.json(orgs);
  } catch (error) {
    console.error('Fetch organizations error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/organizations/:orgId', requireAuth, requireOrgAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.orgId },
      include: { plan: true }
    });
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    return res.json(org);
  } catch (error) {
    console.error('View organization details error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/organizations/:orgId', requireAuth, requireOrgAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const body = organizationSchema.parse(req.body);
    const updated = await prisma.organization.update({
      where: { id: req.orgId },
      data: {
        name: body.name,
        description: body.description
      }
    });

    await writeAuditLog(req.orgId!, null, req.user.id, req.user.email, 'ORGANIZATION_UPDATED', 'Organization', `Updated details of organization: ${updated.name}`);

    return res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update organization error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/organizations/:orgId', requireAuth, requireOrgAccess('OWNER'), async (req: Request, res: Response) => {
  try {
    await prisma.organization.delete({
      where: { id: req.orgId }
    });

    await writeAuditLog(req.orgId!, null, req.user.id, req.user.email, 'ORGANIZATION_DELETED', 'Organization', `Permanently deleted organization: ${req.orgId}`);

    return res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Organization Dashboard Summary
app.get('/api/organizations/:orgId/summary', requireAuth, requireOrgAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;
    const [workflowsCount, executionsCount, successfulExecutionsCount, leadsCount] = await prisma.$transaction([
      prisma.workflow.count({ where: { workspace: { orgId } } }),
      prisma.workflowExecution.count({ where: { workspace: { orgId } } }),
      prisma.workflowExecution.count({ where: { workspace: { orgId }, status: 'SUCCESS' } }),
      prisma.lead.count({ where: { workspace: { orgId } } })
    ]);

    const successRate = executionsCount > 0 
      ? Math.round((successfulExecutionsCount / executionsCount) * 100) 
      : 100;

    return res.json({
      workflowsCount,
      executionsCount,
      successfulExecutionsCount,
      leadsCount,
      successRate
    });
  } catch (error) {
    console.error('Fetch organization summary error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ----------------------------------------------------
// Workspace CRUD Endpoints
// ----------------------------------------------------

app.get('/api/organizations/:orgId/workspaces', requireAuth, requireOrgAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: { orgId: req.orgId },
      orderBy: { name: 'asc' }
    });

    const sanitized = workspaces.map(w => ({
      id: w.id,
      orgId: w.orgId,
      name: w.name,
      description: w.description,
      status: w.status,
      securityType: w.securityType,
      isPasswordProtected: !!(w.passwordHash && w.passwordSalt),
      createdAt: w.createdAt
    }));

    return res.json(sanitized);
  } catch (error) {
    console.error('Fetch workspaces error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/organizations/:orgId/workspaces', requireAuth, requireOrgAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const body = workspaceSchema.parse(req.body);
    const org = await prisma.organization.findUnique({
      where: { id: req.orgId },
      include: { plan: true }
    });

    if (org && org.plan) {
      const currentWorkspacesCount = await prisma.workspace.count({
        where: { orgId: req.orgId }
      });
      if (currentWorkspacesCount >= org.plan.maxWorkspaces) {
        return res.status(400).json({ error: `Plan limit reached: Max workspaces allowed on your plan is ${org.plan.maxWorkspaces}.` });
      }
    }

    let hash: string | null = null;
    let salt: string | null = null;
    if (body.password) {
      const creds = hashPassword(body.password);
      hash = creds.hash;
      salt = creds.salt;
    }

    const ws = await prisma.workspace.create({
      data: {
        orgId: req.orgId!,
        name: body.name,
        description: body.description,
        securityType: body.securityType,
        passwordHash: hash,
        passwordSalt: salt
      }
    });

    await writeAuditLog(req.orgId!, ws.id, req.user.id, req.user.email, 'WORKSPACE_CREATED', 'Workspace', `Created workspace: ${ws.name}`);

    return res.json({
      id: ws.id,
      name: ws.name,
      description: ws.description,
      securityType: ws.securityType,
      isPasswordProtected: !!(ws.passwordHash && ws.passwordSalt)
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create workspace error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/organizations/:orgId/workspaces/:workspaceId', requireAuth, requireWorkspaceAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const body = workspaceSchema.partial().parse(req.body);
    const updated = await prisma.workspace.update({
      where: { id: req.workspaceId },
      data: {
        name: body.name,
        description: body.description,
        securityType: body.securityType
      }
    });

    await writeAuditLog(req.orgId!, req.workspaceId!, req.user.id, req.user.email, 'WORKSPACE_UPDATED', 'Workspace', `Updated details of workspace: ${updated.name}`);

    return res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update workspace error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/organizations/:orgId/workspaces/:workspaceId', requireAuth, requireWorkspaceAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    await prisma.workspace.delete({
      where: { id: req.workspaceId }
    });

    await writeAuditLog(req.orgId!, null, req.user.id, req.user.email, 'WORKSPACE_DELETED', 'Workspace', `Permanently deleted workspace: ${req.workspaceId}`);

    return res.json({ success: true, message: 'Workspace deleted successfully.' });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Configure workspace passcode settings
app.post('/api/organizations/:orgId/workspaces/:workspaceId/password', requireAuth, requireWorkspaceAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const body = workspacePasswordSchema.parse(req.body);
    const ws = await prisma.workspace.findUnique({ where: { id: req.workspaceId } });
    if (!ws) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }

    let hash: string | null = ws.passwordHash;
    let salt: string | null = ws.passwordSalt;

    if (body.action === 'ENABLE') {
      if (!body.password) {
        return res.status(400).json({ error: 'Password required to enable security.' });
      }
      const creds = hashPassword(body.password);
      hash = creds.hash;
      salt = creds.salt;
    } else if (body.action === 'DISABLE') {
      if (!ws.passwordHash || !ws.passwordSalt) {
        return res.status(400).json({ error: 'Workspace security is not enabled.' });
      }
      if (!body.currentPassword) {
        return res.status(400).json({ error: 'Current password is required to disable.' });
      }
      const isValid = verifyPassword(body.currentPassword, ws.passwordHash, ws.passwordSalt);
      if (!isValid) {
        return res.status(400).json({ error: 'Incorrect password.' });
      }
      hash = null;
      salt = null;
    } else if (body.action === 'UPDATE') {
      if (!ws.passwordHash || !ws.passwordSalt) {
        return res.status(400).json({ error: 'Workspace security is not enabled.' });
      }
      if (!body.currentPassword || !body.newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required.' });
      }
      const isValid = verifyPassword(body.currentPassword, ws.passwordHash, ws.passwordSalt);
      if (!isValid) {
        return res.status(400).json({ error: 'Incorrect password.' });
      }
      const creds = hashPassword(body.newPassword);
      hash = creds.hash;
      salt = creds.salt;
    }

    const updated = await prisma.workspace.update({
      where: { id: req.workspaceId },
      data: {
        passwordHash: hash,
        passwordSalt: salt
      }
    });

    await writeAuditLog(req.orgId!, req.workspaceId!, req.user.id, req.user.email, 'WORKSPACE_SECURITY_CHANGED', 'Workspace', `Changed security passcode status: ${body.action}`);

    return res.json({
      id: updated.id,
      name: updated.name,
      isPasswordProtected: !!(updated.passwordHash && updated.passwordSalt)
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Workspace password error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Workspace statistics dashboard summary
app.get('/api/organizations/:orgId/workspaces/:workspaceId/summary', requireAuth, requireWorkspaceAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const [workflowsCount, executionsCount, successfulExecutionsCount, leadsCount] = await prisma.$transaction([
      prisma.workflow.count({ where: { workspaceId } }),
      prisma.workflowExecution.count({ where: { workspaceId } }),
      prisma.workflowExecution.count({ where: { workspaceId, status: 'SUCCESS' } }),
      prisma.lead.count({ where: { workspaceId } })
    ]);

    const successRate = executionsCount > 0 
      ? Math.round((successfulExecutionsCount / executionsCount) * 100) 
      : 100;

    return res.json({
      workflowsCount,
      executionsCount,
      successfulExecutionsCount,
      leadsCount,
      successRate
    });
  } catch (error) {
    console.error('Fetch workspace statistics error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ----------------------------------------------------
// Team Management Endpoints
// ----------------------------------------------------

app.get('/api/organizations/:orgId/members', requireAuth, requireOrgAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const members = await prisma.organizationMember.findMany({
      where: { orgId: req.orgId },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: { role: 'asc' }
    });

    const parsed = members.map(m => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt
    }));

    return res.json(parsed);
  } catch (error) {
    console.error('Fetch members error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/organizations/:orgId/members/invite', requireAuth, requireOrgAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const body = teamInviteSchema.parse(req.body);
    
    // Check if user is already a member
    const targetUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (targetUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: { orgId: req.orgId!, userId: targetUser.id }
        }
      });
      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member of this organization.' });
      }
    }

    // Resolve or invite user
    let userId = targetUser?.id;
    if (!userId) {
      // Invite mock: Create placeholder user with random password
      const pwMock = hashPassword(crypto.randomBytes(16).toString('hex'));
      const placeholder = await prisma.user.create({
        data: {
          email: body.email,
          name: body.email.split('@')[0],
          passwordHash: pwMock.hash,
          passwordSalt: pwMock.salt
        }
      });
      userId = placeholder.id;
    }

    const member = await prisma.organizationMember.create({
      data: {
        orgId: req.orgId!,
        userId: userId,
        role: body.role,
        status: 'INVITED' // INVITED status simulates pending email invitation
      }
    });

    await writeAuditLog(req.orgId!, null, req.user.id, req.user.email, 'TEAM_MEMBER_INVITED', 'OrganizationMember', `Invited user: ${body.email} as role: ${body.role}`);

    return res.json(member);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Invite member error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/organizations/:orgId/members/:memberId/role', requireAuth, requireOrgAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const body = teamRoleSchema.parse(req.body);

    const existing = await prisma.organizationMember.findUnique({ where: { id: memberId } });
    if (!existing || existing.orgId !== req.orgId) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // Prevent changing own role if owner
    if (existing.userId === req.user.id && existing.role === 'OWNER') {
      return res.status(400).json({ error: 'Owners cannot downgrade their own role.' });
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: body.role }
    });

    await writeAuditLog(req.orgId!, null, req.user.id, req.user.email, 'TEAM_MEMBER_ROLE_CHANGED', 'OrganizationMember', `Changed role of member: ${memberId} to: ${body.role}`);

    return res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Change role error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/organizations/:orgId/members/:memberId/status', requireAuth, requireOrgAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const body = teamStatusSchema.parse(req.body);

    const existing = await prisma.organizationMember.findUnique({ where: { id: memberId } });
    if (!existing || existing.orgId !== req.orgId) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { status: body.status }
    });

    return res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update status error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/organizations/:orgId/members/:memberId', requireAuth, requireOrgAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const existing = await prisma.organizationMember.findUnique({ where: { id: memberId } });
    if (!existing || existing.orgId !== req.orgId) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    if (existing.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot remove organization owners.' });
    }

    await prisma.organizationMember.delete({ where: { id: memberId } });

    await writeAuditLog(req.orgId!, null, req.user.id, req.user.email, 'TEAM_MEMBER_REMOVED', 'OrganizationMember', `Removed team member: ${memberId}`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ----------------------------------------------------
// Workflow Canvas Scoped Endpoints
// ----------------------------------------------------

app.get('/api/workspaces/:workspaceId/workflows', requireAuth, requireWorkspaceAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const list = await prisma.workflow.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    const parsed = list.map(w => ({
      id: w.id,
      workspaceId: w.workspaceId,
      name: w.name,
      status: w.status,
      definition: JSON.parse(w.definition),
      createdAt: w.createdAt,
      updatedAt: w.updatedAt
    }));

    return res.json(parsed);
  } catch (error) {
    console.error('Fetch workflows error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/workspaces/:workspaceId/workflows', requireAuth, requireWorkspaceAccess('MEMBER'), async (req: Request, res: Response) => {
  try {
    const body = workflowSchema.parse(req.body);
    let workflow;

    if (body.id) {
      // Update existing workflow
      const existing = await prisma.workflow.findUnique({ where: { id: body.id } });
      if (!existing || existing.workspaceId !== req.workspaceId) {
        return res.status(404).json({ error: 'Workflow not found inside this workspace.' });
      }

      workflow = await prisma.workflow.update({
        where: { id: body.id },
        data: {
          name: body.name,
          status: body.status,
          definition: JSON.stringify(body.definition)
        }
      });
      await writeAuditLog(req.orgId!, req.workspaceId!, req.user.id, req.user.email, 'WORKFLOW_UPDATED', 'Workflow', `Updated workflow definition: ${workflow.name}`);
    } else {
      // Create new workflow: Enforce workspace plan limits
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.workspaceId },
        include: { organization: { include: { plan: true } } }
      });

      if (workspace && workspace.organization.plan) {
        // Enforce max workflows allowed inside the organization
        const currentWorkflowsCount = await prisma.workflow.count({
          where: {
            workspace: { orgId: workspace.orgId }
          }
        });
        // We enforce organization-level workflow count ceiling
        if (currentWorkflowsCount >= workspace.organization.plan.maxWorkspaces * 3) { // 3 workflows per workspace is a nice multiplier limit
          return res.status(400).json({ error: `Plan limit reached: Total workflows ceiling reached for your plan.` });
        }
      }

      workflow = await prisma.workflow.create({
        data: {
          workspaceId: req.workspaceId!,
          name: body.name,
          status: body.status,
          definition: JSON.stringify(body.definition)
        }
      });
      await writeAuditLog(req.orgId!, req.workspaceId!, req.user.id, req.user.email, 'WORKFLOW_CREATED', 'Workflow', `Created workflow: ${workflow.name}`);
    }

    return res.json({
      id: workflow.id,
      workspaceId: workflow.workspaceId,
      name: workflow.name,
      status: workflow.status,
      definition: JSON.parse(workflow.definition)
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Save workflow error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/workspaces/:workspaceId/workflows/:id', requireAuth, requireWorkspaceAccess('MEMBER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.workflow.findUnique({ where: { id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    await prisma.workflow.delete({ where: { id } });

    await writeAuditLog(req.orgId!, req.workspaceId!, req.user.id, req.user.email, 'WORKFLOW_DELETED', 'Workflow', `Deleted workflow: ${existing.name}`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ----------------------------------------------------
// Execution & WhatsApp Log Scoped Endpoints
// ----------------------------------------------------

app.get('/api/workspaces/:workspaceId/executions', requireAuth, requireWorkspaceAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const list = await prisma.workflowExecution.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        workflow: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const parsed = list.map(e => ({
      id: e.id,
      workflowId: e.workflowId,
      contactId: e.contactId,
      status: e.status,
      stepResults: JSON.parse(e.stepResults),
      createdAt: e.createdAt,
      workflow: { name: e.workflow.name }
    }));

    return res.json(parsed);
  } catch (error) {
    console.error('Fetch executions error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/workspaces/:workspaceId/whatsapp/history', requireAuth, requireWorkspaceAccess('VIEWER'), async (req: Request, res: Response) => {
  const history = whatsappService.getHistory(req.orgId!); // scopes using orgId inside class
  return res.json(history);
});

app.post('/api/workspaces/:workspaceId/whatsapp/clear', requireAuth, requireWorkspaceAccess('MEMBER'), async (req: Request, res: Response) => {
  whatsappService.clearHistory(req.orgId!);
  return res.json({ success: true });
});

// ----------------------------------------------------
// Leads CRUD (Workspace Scoped) Endpoints
// ----------------------------------------------------

app.get('/api/workspaces/:workspaceId/leads', requireAuth, requireWorkspaceAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const search = req.query.search ? String(req.query.search).trim() : '';
    const status = req.query.status ? String(req.query.status).trim() : '';
    const source = req.query.source ? String(req.query.source).trim() : '';
    
    const sortBy = req.query.sortBy && ['name', 'status', 'createdAt'].includes(String(req.query.sortBy))
      ? String(req.query.sortBy)
      : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const whereClause: any = {
      workspaceId,
      AND: []
    };

    if (status) {
      whereClause.AND.push({ status });
    }
    if (source) {
      whereClause.AND.push({ source });
    }
    if (search) {
      whereClause.AND.push({
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } }
        ]
      });
    }

    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    const [leads, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit
      }),
      prisma.lead.count({
        where: whereClause
      })
    ]);

    return res.json({
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Fetch leads list error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/workspaces/:workspaceId/leads', requireAuth, requireWorkspaceAccess('MEMBER'), async (req: Request, res: Response) => {
  try {
    const body = leadSchema.parse(req.body);
    const workspaceId = req.workspaceId!;

    // Enforce Leads plan limits
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { organization: { include: { plan: true } } }
    });

    if (workspace && workspace.organization.plan) {
      const currentLeads = await prisma.lead.count({
        where: {
          workspace: { orgId: workspace.orgId }
        }
      });
      if (currentLeads >= workspace.organization.plan.maxLeads) {
        return res.status(400).json({ error: `Plan limit reached: Max leads capacity on your plan is ${workspace.organization.plan.maxLeads}. Please upgrade.` });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        workspaceId,
        name: body.name,
        email: body.email || null,
        phone: body.phone,
        status: body.status,
        source: body.source
      }
    });

    await writeAuditLog(req.orgId!, workspaceId, req.user.id, req.user.email, 'LEAD_CREATED', 'Lead', `Created lead: ${lead.name}`);

    return res.json(lead);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create lead error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/workspaces/:workspaceId/leads/:id', requireAuth, requireWorkspaceAccess('MEMBER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = leadSchema.partial().parse(req.body);

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'Lead not found in this workspace.' });
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email || undefined,
        phone: body.phone,
        status: body.status,
        source: body.source
      }
    });

    return res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update lead error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/workspaces/:workspaceId/leads/:id', requireAuth, requireWorkspaceAccess('MEMBER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    await prisma.lead.delete({ where: { id } });

    await writeAuditLog(req.orgId!, req.workspaceId!, req.user.id, req.user.email, 'LEAD_DELETED', 'Lead', `Deleted lead: ${existing.name}`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ----------------------------------------------------
// Webhook Runner (Scoped to active Workspace)
// ----------------------------------------------------

// GET verification for Meta WhatsApp Business webhook
app.get('/api/webhooks/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_VERIFY_TOKEN || 'verification_token';

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] Meta verification challenge successful!');
      return res.status(200).send(challenge);
    } else {
      console.warn('[Webhook] Meta verification token mismatch.');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

// POST incoming WhatsApp message handler supporting Meta payloads and simulation payloads
app.post('/api/webhooks/whatsapp', async (req: Request, res: Response) => {
  // Check for built-in simulation webhook payloads
  const isSimulation = req.body && req.body.contactId && req.body.messageText;

  if (isSimulation) {
    try {
      const workspaceId = req.header('X-Workspace-ID') || req.body.workspaceId;
      if (!workspaceId) {
        return res.status(400).json({ error: 'Missing target Workspace context (X-Workspace-ID header or body).' });
      }

      // Fire and forget workflow execution
      WorkflowProcessor.handleIncomingMessage(workspaceId.trim(), req.body.contactId, req.body.messageText);
      
      return res.json({
        success: true,
        message: `Webhook simulation triggered in workspace: ${workspaceId.trim()}`
      });
    } catch (simErr: any) {
      console.error('[Webhook] Simulation runner error:', simErr);
      return res.status(500).json({ error: 'Simulation execution error.' });
    }
  }

  // Parse Meta WhatsApp Webhook Payload
  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    return res.status(400).json({ error: 'Unsupported webhook payload object.' });
  }

  // Meta expects a rapid response to avoid timeouts, acknowledge with 200 immediately
  res.sendStatus(200);

  // Process message asynchronously
  (async () => {
    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          const metadata = value.metadata;
          const messages = value.messages || [];

          if (!metadata || messages.length === 0) continue;

          const phoneNumberId = metadata.phone_number_id;

          // Resolve workspace context (Database routing table vs Environment variables fallback)
          let workspaceId = '';
          const mappedNumber = await prisma.whatsAppNumber.findUnique({
            where: { phoneNumberId }
          });

          if (mappedNumber) {
            workspaceId = mappedNumber.workspaceId;
          } else {
            const envPhoneId = process.env.META_PHONE_NUMBER_ID || '';
            if (phoneNumberId === envPhoneId) {
              const defaultWorkspace = await prisma.workspace.findFirst();
              if (defaultWorkspace) {
                workspaceId = defaultWorkspace.id;
              }
            }
          }

          if (!workspaceId) {
            console.warn(`[Webhook] Incoming message ignored: Unmapped Meta phone_number_id: "${phoneNumberId}".`);
            continue;
          }

          for (const msg of messages) {
            const customerPhone = msg.from;
            const messageId = msg.id;
            const msgType = msg.type;

            // Only text messages trigger workflow executions; log and ignore other types cleanly
            if (msgType !== 'text') {
              console.log(`[Webhook] Ignored non-text message type: "${msgType}" from ${customerPhone}.`);
              continue;
            }

            const messageText = msg.text?.body;
            if (!messageText) continue;

            console.log(`[Webhook] Incoming Meta message parsed successfully from ${customerPhone}: "${messageText}"`);

            // Execute matching workflows in the resolved workspace context
            await WorkflowProcessor.handleIncomingMessage(workspaceId, customerPhone, messageText, messageId);
          }
        }
      }
    } catch (metaErr: any) {
      console.error('[Webhook] Failed to process Meta webhook:', metaErr.message || metaErr);
    }
  })();
});

// ----------------------------------------------------
// SaaS Billing Summary & Subscription Upgrades
// ----------------------------------------------------

app.get('/api/organizations/:orgId/billing', requireAuth, requireOrgAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.orgId },
      include: { plan: true }
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found.' });
    }

    // Gather active usage counts
    const [leadsCount, workspacesCount, executionsCount] = await prisma.$transaction([
      prisma.lead.count({ where: { workspace: { orgId: org.id } } }),
      prisma.workspace.count({ where: { orgId: org.id } }),
      prisma.workflowExecution.count({ where: { workspace: { orgId: org.id } } })
    ]);

    return res.json({
      currentPlan: org.plan?.name || 'No Active Plan',
      price: org.plan?.price || 0,
      limits: {
        maxWorkspaces: org.plan?.maxWorkspaces || 1,
        maxLeads: org.plan?.maxLeads || 100,
        maxExecutions: org.plan?.maxExecutions || 500
      },
      usage: {
        leads: leadsCount,
        workspaces: workspacesCount,
        executions: executionsCount
      }
    });
  } catch (error) {
    console.error('Fetch billing info error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/organizations/:orgId/billing/upgrade', requireAuth, requireOrgAccess('ADMIN'), async (req: Request, res: Response) => {
  try {
    const body = billingUpgradeSchema.parse(req.body);
    const targetPlan = await prisma.plan.findUnique({
      where: { name: body.planName }
    });

    if (!targetPlan) {
      return res.status(404).json({ error: 'Billing plan option not found.' });
    }

    const updated = await prisma.organization.update({
      where: { id: req.orgId },
      data: { planId: targetPlan.id },
      include: { plan: true }
    });

    await writeAuditLog(req.orgId!, null, req.user.id, req.user.email, 'SUBSCRIPTION_UPGRADED', 'Subscription', `Upgraded plan to: ${body.planName}`);

    return res.json({
      success: true,
      message: `Subscription successfully updated to ${body.planName}.`,
      plan: updated.plan
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Upgrade billing error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ----------------------------------------------------
// Super Admin Platform Endpoints
// ----------------------------------------------------

app.get('/api/admin/dashboard', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const [orgsCount, usersCount, workspacesCount, leadsCount, runsCount] = await prisma.$transaction([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.lead.count(),
      prisma.workflowExecution.count()
    ]);

    // Simple revenue math: Sum prices of active plan organizations
    const orgs = await prisma.organization.findMany({
      include: { plan: true }
    });
    const monthlyRevenue = orgs.reduce((acc, o) => acc + (o.plan?.price || 0), 0);

    return res.json({
      totalOrganizations: orgsCount,
      totalUsers: usersCount,
      totalWorkspaces: workspacesCount,
      totalLeads: leadsCount,
      totalExecutions: runsCount,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Super Admin Dashboard KPI error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/admin/organizations', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      include: {
        plan: true,
        members: { include: { user: { select: { email: true } } } },
        _count: {
          select: { workspaces: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const parsed = orgs.map(o => {
      const owner = o.members.find(m => m.role === 'OWNER');
      return {
        id: o.id,
        name: o.name,
        description: o.description,
        status: o.status,
        planName: o.plan?.name || 'None',
        ownerEmail: owner?.user.email || 'No Owner',
        workspacesCount: o._count.workspaces,
        createdAt: o.createdAt
      };
    });

    return res.json(parsed);
  } catch (error) {
    console.error('Super Admin Fetch Orgs error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/admin/organizations/:id/status', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).parse(req.body);

    const updated = await prisma.organization.update({
      where: { id },
      data: { status: body.status }
    });

    return res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Super Admin Change Org Status error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/admin/organizations/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.organization.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Super Admin Delete Org error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/admin/plans', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
    return res.json(plans);
  } catch (error) {
    console.error('Super Admin Fetch Plans error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/admin/plans', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const body = planAdminSchema.parse(req.body);
    const plan = await prisma.plan.create({
      data: {
        name: body.name,
        price: body.price,
        maxWorkspaces: body.maxWorkspaces,
        maxLeads: body.maxLeads,
        maxExecutions: body.maxExecutions
      }
    });
    return res.json(plan);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Super Admin Create Plan error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/admin/plans/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = planAdminSchema.partial().parse(req.body);
    const updated = await prisma.plan.update({
      where: { id },
      data: {
        name: body.name,
        price: body.price,
        maxWorkspaces: body.maxWorkspaces,
        maxLeads: body.maxLeads,
        maxExecutions: body.maxExecutions
      }
    });
    return res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Super Admin Update Plan error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/admin/audit-logs', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    return res.json(logs);
  } catch (error) {
    console.error('Super Admin Fetch Audit Logs error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`[Server] KULMITRA SaaS backend running on port ${PORT}`);
});
