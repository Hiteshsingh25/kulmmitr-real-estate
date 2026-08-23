import { PrismaClient } from '@prisma/client';
import { hashPassword } from './utils/crypto';

const prisma = new PrismaClient();

async function runSeed() {
  console.log('=== STARTING DATABASE SEEDING ===');

  // 1. Clean existing records (Optional fallback check)
  console.log('Clearing existing data...');
  await prisma.auditLog.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.workflowExecution.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.plan.deleteMany({});

  // 2. Create SaaS Plans
  console.log('Creating SaaS plans...');
  const planFree = await prisma.plan.create({
    data: {
      name: 'Free Plan',
      price: 0,
      maxWorkspaces: 1,
      maxLeads: 100,
      maxExecutions: 500
    }
  });

  const planPro = await prisma.plan.create({
    data: {
      name: 'Pro Plan',
      price: 49.00,
      maxWorkspaces: 5,
      maxLeads: 5000,
      maxExecutions: 20000
    }
  });

  const planBusiness = await prisma.plan.create({
    data: {
      name: 'Business Plan',
      price: 199.00,
      maxWorkspaces: 20,
      maxLeads: 50000,
      maxExecutions: 100000
    }
  });
  console.log('✓ Standard plans created.');

  // 3. Create Users with salted PBKDF2 passwords
  console.log('Creating test user accounts...');
  
  const pwSuper = hashPassword('SuperPassword123');
  const superAdminUser = await prisma.user.create({
    data: {
      email: 'superadmin@kulmitra.com',
      name: 'KULMITRA Super Admin',
      passwordHash: pwSuper.hash,
      passwordSalt: pwSuper.salt,
      role: 'SUPER_ADMIN'
    }
  });

  const pwOwner = hashPassword('OwnerPassword123');
  const ownerUser = await prisma.user.create({
    data: {
      email: 'owner@kulmitra.com',
      name: 'Jane Owner',
      passwordHash: pwOwner.hash,
      passwordSalt: pwOwner.salt,
      role: 'USER'
    }
  });

  const pwAdmin = hashPassword('AdminPassword123');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@kulmitra.com',
      name: 'Bob Admin',
      passwordHash: pwAdmin.hash,
      passwordSalt: pwAdmin.salt,
      role: 'USER'
    }
  });

  const pwMember = hashPassword('MemberPassword123');
  const memberUser = await prisma.user.create({
    data: {
      email: 'member@kulmitra.com',
      name: 'Mark Member',
      passwordHash: pwMember.hash,
      passwordSalt: pwMember.salt,
      role: 'USER'
    }
  });

  const pwViewer = hashPassword('ViewerPassword123');
  const viewerUser = await prisma.user.create({
    data: {
      email: 'viewer@kulmitra.com',
      name: 'Valerie Viewer',
      passwordHash: pwViewer.hash,
      passwordSalt: pwViewer.salt,
      role: 'USER'
    }
  });
  console.log('✓ Users created.');

  // 4. Create Organizations
  console.log('Creating Organizations...');
  
  const orgA = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      description: 'Acme Corporate Workspace Operations',
      planId: planPro.id,
      status: 'ACTIVE'
    }
  });

  const orgB = await prisma.organization.create({
    data: {
      name: 'Stark Industries',
      description: 'Stark Labs R&D Automation Sandbox',
      planId: planFree.id,
      status: 'ACTIVE'
    }
  });
  console.log('✓ Organizations created.');

  // 5. Create Organization Memberships
  console.log('Setting up role memberships...');
  
  // Org A: Owner, Admin, Member, Viewer
  await prisma.organizationMember.create({
    data: { orgId: orgA.id, userId: ownerUser.id, role: 'OWNER', status: 'ACTIVE' }
  });
  await prisma.organizationMember.create({
    data: { orgId: orgA.id, userId: adminUser.id, role: 'ADMIN', status: 'ACTIVE' }
  });
  await prisma.organizationMember.create({
    data: { orgId: orgA.id, userId: memberUser.id, role: 'MEMBER', status: 'ACTIVE' }
  });
  await prisma.organizationMember.create({
    data: { orgId: orgA.id, userId: viewerUser.id, role: 'VIEWER', status: 'ACTIVE' }
  });

  // Org B: Jane Owner owns this too! Bob Admin is invited.
  await prisma.organizationMember.create({
    data: { orgId: orgB.id, userId: ownerUser.id, role: 'OWNER', status: 'ACTIVE' }
  });
  await prisma.organizationMember.create({
    data: { orgId: orgB.id, userId: adminUser.id, role: 'MEMBER', status: 'INVITED' }
  });
  console.log('✓ Memberships seeded.');

  // 6. Create Workspaces
  console.log('Seeding workspaces...');
  
  // Org A Workspaces
  const wsSales = await prisma.workspace.create({
    data: {
      orgId: orgA.id,
      name: 'Sales Workspace',
      description: 'Sales lead capture and auto-followups',
      securityType: 'PRIVATE',
      status: 'ACTIVE'
    }
  });

  const wsSupport = await prisma.workspace.create({
    data: {
      orgId: orgA.id,
      name: 'Support Operations',
      description: 'Customer support automated replies',
      securityType: 'MEMBERS',
      status: 'ACTIVE'
    }
  });

  const wsMarketing = await prisma.workspace.create({
    data: {
      orgId: orgA.id,
      name: 'Marketing Campaigns',
      description: 'Public lead intake channel',
      securityType: 'PUBLIC',
      passwordHash: hashPassword('WorkspacePass123').hash,
      passwordSalt: hashPassword('WorkspacePass123').salt,
      status: 'ACTIVE'
    }
  });

  // Org B Workspaces
  const wsDefault = await prisma.workspace.create({
    data: {
      orgId: orgB.id,
      name: 'Main Lab Workspace',
      description: 'Default sandbox channel',
      securityType: 'PRIVATE',
      status: 'ACTIVE'
    }
  });
  console.log('✓ Workspaces seeded.');

  // 7. Seed Starter Workflows & Leads in wsSales
  console.log('Seeding starter workflow and leads...');
  
  const workflowDefinition = {
    nodes: [
      {
        id: 'node_trigger',
        type: 'incomingMessage',
        position: { x: 100, y: 150 },
        data: { keyword: 'hello' }
      },
      {
        id: 'node_action',
        type: 'sendWhatsapp',
        position: { x: 350, y: 150 },
        data: { message: 'Hello! Welcome to Acme Corp. We have captured your contact info.' }
      }
    ],
    edges: [
      { id: 'e1_2', source: 'node_trigger', target: 'node_action' }
    ]
  };

  await prisma.workflow.create({
    data: {
      workspaceId: wsSales.id,
      name: 'Welcome Auto-Responder',
      status: 'ACTIVE',
      definition: JSON.stringify(workflowDefinition)
    }
  });

  // Seed Leads
  await prisma.lead.create({
    data: {
      workspaceId: wsSales.id,
      name: 'Bruce Wayne',
      email: 'bruce@waynecorp.com',
      phone: '+15551234567',
      status: 'QUALIFIED',
      source: 'MANUAL'
    }
  });

  await prisma.lead.create({
    data: {
      workspaceId: wsSales.id,
      name: 'Clark Kent',
      email: 'clark@dailyplanet.com',
      phone: '+15559876543',
      status: 'NEW',
      source: 'WEBHOOK'
    }
  });

  console.log('✓ Starter data loaded.');
  console.log('=== DATABASE SEEDING COMPLETED SUCCESSFULLY ===');
}

runSeed()
  .catch((err) => {
    console.error('X SEEDING FAILED:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
