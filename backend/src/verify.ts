import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== STARTING KULMITRA META WHATSAPP INTEGRATION TESTS ===\n');

  // 0. Ensure default environment configs
  process.env.META_VERIFY_TOKEN = 'test_verify_token';
  process.env.META_PHONE_NUMBER_ID = 'test_phone_id';
  process.env.META_ACCESS_TOKEN = 'test_access_token';

  // 1. Authenticate & Obtain Token
  console.log('1. Authenticating user credentials...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@kulmitra.com',
      password: 'OwnerPassword123'
    })
  });

  if (!loginRes.ok) {
    throw new Error(`Failed to login: ${await loginRes.text()}`);
  }

  const loginData = (await loginRes.json()) as any;
  const token = loginData.token;
  const orgId = loginData.defaultOrgId;
  const defaultWorkspaceId = loginData.defaultWorkspaceId;
  console.log(`✓ Authenticated! Token: ${token.substring(0, 8)}... | Default Workspace: ${defaultWorkspaceId}\n`);

  // 2. GET Webhook Verification Tests
  console.log('2. Testing Meta GET verification endpoint...');
  
  // Test correct verify token
  const verifySuccessRes = await fetch(
    `${BASE_URL}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_verify_token&hub.challenge=challenge_token_987`
  );

  if (verifySuccessRes.ok) {
    const bodyText = await verifySuccessRes.text();
    if (bodyText === 'challenge_token_987') {
      console.log('✓ Success! Correct token returned challenge: "challenge_token_987"');
    } else {
      throw new Error(`X Failure! Challenge mismatch. Returned: ${bodyText}`);
    }
  } else {
    throw new Error(`X Failure! Correct verification blocked. Status: ${verifySuccessRes.status}`);
  }

  // Test incorrect verify token
  const verifyFailRes = await fetch(
    `${BASE_URL}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG_TOKEN&hub.challenge=challenge_token_987`
  );

  if (verifyFailRes.status === 403) {
    console.log('✓ Success! Incorrect token blocked with HTTP 403 Forbidden.');
  } else {
    throw new Error(`X Failure! Incorrect token was not blocked. Status: ${verifyFailRes.status}`);
  }
  console.log();

  // 3. Set up Database-driven WhatsApp Number Tenant Routing
  console.log('3. Registering WhatsAppNumber routing mapping in Database...');
  
  // Clean up any existing mapping first
  await prisma.whatsAppNumber.deleteMany({
    where: { phoneNumberId: 'meta_phone_id_999' }
  });

  const wsNumberConfig = await prisma.whatsAppNumber.create({
    data: {
      workspaceId: defaultWorkspaceId,
      phoneNumberId: 'meta_phone_id_999',
      phoneNumber: '15551234567',
      status: 'ACTIVE'
    }
  });

  console.log(`✓ Mapped phone_number_id "meta_phone_id_999" -> Workspace "${wsNumberConfig.workspaceId}"\n`);

  // 4. Test Incoming Text Message webhook processing
  console.log('4. Simulating incoming Meta WhatsApp text webhook payload...');
  const customerPhone = '19998887777';
  const metaMessageId = 'meta_test_msg_unique_id_001';
  
  // Ensure no existing logs or lead conflicts
  await prisma.lead.deleteMany({ where: { phone: customerPhone } });
  await prisma.workflowExecution.deleteMany({ where: { externalMessageId: metaMessageId } });

  const metaPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'meta_biz_acc_id',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: 'meta_phone_id_999'
              },
              contacts: [
                {
                  profile: { name: 'Meta Tester' },
                  wa_id: customerPhone
                }
              ],
              messages: [
                {
                  from: customerPhone,
                  id: metaMessageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: 'hello' }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const postWebhookRes = await fetch(`${BASE_URL}/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metaPayload)
  });

  if (postWebhookRes.ok) {
    console.log('✓ Webhook post accepted with HTTP 200.');
  } else {
    throw new Error(`X Webhook post failed: ${await postWebhookRes.text()}`);
  }

  // Wait a moment for async processing
  await new Promise(resolve => setTimeout(resolve, 800));

  // Verify Lead capture
  const leads = await prisma.lead.findMany({ where: { workspaceId: defaultWorkspaceId, phone: customerPhone } });
  if (leads.length > 0) {
    console.log(`✓ Lead captured dynamically inside workspace context! Lead Name: "${leads[0].name}"`);
  } else {
    throw new Error('X Failure! Lead was not captured by the webhook message runner.');
  }

  // Verify WorkflowExecution log
  const executions = await prisma.workflowExecution.findMany({
    where: { workspaceId: defaultWorkspaceId, externalMessageId: metaMessageId }
  });

  if (executions.length > 0) {
    console.log(`✓ Execution run logged with unique externalMessageId: "${executions[0].externalMessageId}"`);
  } else {
    throw new Error('X Failure! WorkflowExecution was not registered or mapped to the external message ID.');
  }
  console.log();

  // 5. Test Duplicate Webhook Prevention (Deduplication)
  console.log('5. Retrying duplicate Meta webhook message payload...');
  const duplicateWebhookRes = await fetch(`${BASE_URL}/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metaPayload)
  });

  if (!duplicateWebhookRes.ok) {
    throw new Error('X Webhook retry blocked initially (should respond with 200 and bypass processing internally).');
  }

  await new Promise(resolve => setTimeout(resolve, 600));

  const duplicateExecutions = await prisma.workflowExecution.findMany({
    where: { workspaceId: defaultWorkspaceId, externalMessageId: metaMessageId }
  });

  if (duplicateExecutions.length === 1) {
    console.log('✓ Success! Duplicate check worked. Workflow was NOT executed twice.');
  } else {
    throw new Error(`X Failure! Duplicate run execution log found. Executions count: ${duplicateExecutions.length}`);
  }
  console.log();

  // 6. Test Malformed Webhook Payload safety
  console.log('6. Sending malformed Meta webhook payload...');
  const malformedPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              // Missing metadata and messages array
            }
          }
        ]
      }
    ]
  };

  const malformedRes = await fetch(`${BASE_URL}/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(malformedPayload)
  });

  if (malformedRes.ok) {
    console.log('✓ Success! Server handled malformed payload gracefully without crashing.');
  } else {
    throw new Error(`X Failure! Malformed webhook resulted in error status: ${malformedRes.status}`);
  }
  console.log();

  // 7. Cleanup
  console.log('7. Cleaning up test artifacts...');
  await prisma.whatsAppNumber.delete({ where: { id: wsNumberConfig.id } });
  await prisma.lead.deleteMany({ where: { phone: customerPhone } });
  await prisma.workflowExecution.deleteMany({ where: { externalMessageId: metaMessageId } });
  console.log('✓ Database cleaned up.');

  console.log('\n=== ALL KULMITRA META WHATSAPP INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n❌ INTEGRATION TESTS FAILED:');
  console.error(err);
  process.exit(1);
});
