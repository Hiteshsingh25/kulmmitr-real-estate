import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SentMessageLog {
  orgId: string;
  workspaceId?: string;
  contactId: string;
  message: string;
  timestamp: Date;
}

class WhatsAppService {
  // Store sent messages in-memory for live dashboard inspection
  private messageHistory: SentMessageLog[] = [];

  /**
   * Send WhatsApp message using official Meta Cloud API
   * Supports optional workspaceId for tenant credentials routing
   */
  public async sendMessage(orgId: string, contactId: string, message: string, workspaceId?: string): Promise<boolean> {
    // 1. Normalize Phone Number (e.g. "+1 (555) 019-2834" -> "15550192834")
    const cleanPhone = contactId.replace(/\+/g, '').replace(/[^0-9]/g, '').trim();
    if (!cleanPhone) {
      console.error(`[WhatsAppService] Normalization error: Empty phone number string extracted from "${contactId}"`);
      return false;
    }

    // 2. Resolve Meta Credentials (database tenant config vs environment fallback)
    let accessToken = process.env.META_ACCESS_TOKEN || '';
    let phoneNumberId = process.env.META_PHONE_NUMBER_ID || '';
    let graphApiVersion = process.env.META_GRAPH_API_VERSION || 'v18.0';

    if (workspaceId) {
      try {
        const dbConfig = await prisma.whatsAppNumber.findFirst({
          where: { workspaceId, status: 'ACTIVE' }
        });
        if (dbConfig) {
          if (dbConfig.accessToken) accessToken = dbConfig.accessToken;
          if (dbConfig.phoneNumberId) phoneNumberId = dbConfig.phoneNumberId;
        }
      } catch (dbErr) {
        console.error('[WhatsAppService] Error loading workspace WhatsApp credentials:', dbErr);
      }
    }

    if (!accessToken || !phoneNumberId) {
      console.error('[WhatsAppService] Send aborted: Missing Meta Access Token or Phone Number ID configuration.');
      return false;
    }

    const endpoint = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;

    console.log(`[WhatsAppService] Dispatched outgoing WhatsApp message to ${cleanPhone} via Phone Number ID: ${phoneNumberId}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: {
            body: message
          }
        })
      });

      if (!response.ok) {
        let errorData = '';
        try {
          const jsonErr = await response.json();
          errorData = JSON.stringify(jsonErr);
        } catch {
          errorData = await response.text();
        }

        // Clean errors to prevent token leakage in logs
        console.error(`[WhatsAppService] Meta API error (HTTP ${response.status}):`, errorData);
        return false;
      }

      const responseData = (await response.json()) as any;
      console.log(`[WhatsAppService] Message sent successfully. Meta Message ID: ${responseData.messages?.[0]?.id || 'unknown'}`);

      // Log to in-memory history for live UI tracking
      this.messageHistory.push({
        orgId,
        workspaceId,
        contactId,
        message,
        timestamp: new Date()
      });

      return true;
    } catch (fetchErr: any) {
      console.error('[WhatsAppService] HTTP dispatch exception:', fetchErr.message || fetchErr);
      return false;
    }
  }

  public getHistory(orgId: string): SentMessageLog[] {
    return this.messageHistory.filter(m => m.orgId === orgId);
  }

  public clearHistory(orgId: string) {
    this.messageHistory = this.messageHistory.filter(m => m.orgId !== orgId);
  }
}

export const whatsappService = new WhatsAppService();
