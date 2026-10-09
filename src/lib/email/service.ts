import { Order, GatePass, EventConfig } from '../db/types';

export interface EmailDeliveryRecord {
  orderId: string;
  recipientEmail: string;
  sentAt: Date;
  status: 'SENT' | 'FAILED' | 'MOCKED';
  error?: string;
}

const emailDeliveryLog: Map<string, EmailDeliveryRecord> = new Map();

/**
 * Sends a confirmation email with gate pass link and event information.
 * Safe & idempotent: won't crash payment flow if email fails.
 */
export async function sendTicketConfirmationEmail(params: {
  order: Order;
  pass: GatePass;
  event: EventConfig;
  appBaseUrl: string;
}): Promise<{ success: boolean; status: 'SENT' | 'FAILED' | 'MOCKED'; error?: string }> {
  const { order, pass, event, appBaseUrl } = params;
  const passUrl = `${appBaseUrl}/ticket/${encodeURIComponent(pass.qrToken)}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Gate Pass — Raas in Taal</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1A0307; color: #FFF9F0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #2E050D; border: 1px solid #E5A93C; border-radius: 12px; padding: 24px; }
        .header { text-align: center; border-bottom: 1px solid rgba(229,169,60,0.3); padding-bottom: 16px; }
        .title { color: #E5A93C; font-size: 24px; font-weight: bold; margin: 0; }
        .subtitle { color: #F58220; font-size: 14px; margin-top: 4px; }
        .card { background: #4A0E17; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid rgba(229,169,60,0.2); }
        .button { display: inline-block; background: #E5A93C; color: #1A0307; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 6px; margin-top: 16px; text-align: center; }
        .footer { font-size: 12px; color: #FFA347; text-align: center; margin-top: 24px; border-top: 1px solid rgba(229,169,60,0.2); padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">Raas in Taal 2026</h1>
          <p class="subtitle">Organized by Chaos and Chill</p>
        </div>
        <p>Namaste <strong>${order.customerName}</strong>,</p>
        <p>Your booking for Jaipur's most vibrant Dandiya night is confirmed!</p>
        
        <div class="card">
          <p><strong>Booking Ref:</strong> ${order.orderReference}</p>
          <p><strong>Ticket Category:</strong> ${order.categoryCode.toUpperCase()}</p>
          <p><strong>Admitted Attendees:</strong> ${pass.totalAttendees} Person(s)</p>
          <p><strong>Date:</strong> Sunday, 18 October 2026</p>
          <p><strong>Durga Puja:</strong> 5:30 PM | <strong>Dandiya Night:</strong> 6:00 PM</p>
          <p><strong>Venue:</strong> ${event.venue}</p>
        </div>

        <div style="text-align: center;">
          <p>Access your official QR Gate Pass below. Present this pass at the gate for entry:</p>
          <a href="${passUrl}" class="button">View & Download QR Gate Pass</a>
        </div>

        <div style="margin-top: 24px;">
          <h4 style="color: #E5A93C;">Important Gate Rules:</h4>
          <ul>
            <li>This single pass admits <strong>${pass.totalAttendees} attendee(s)</strong> for your booking.</li>
            <li>Partial entry is permitted (group members arriving separately can be admitted progressively).</li>
            <li>Strictly non-transferable and one-time entry limit per attendee.</li>
          </ul>
        </div>

        <div class="footer">
          <p>Contact Organizers: 8003022503 / 8278695419 | Instagram: @chaos_and_chill</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const apiKey = process.env.EMAIL_API_KEY;
  const provider = process.env.EMAIL_PROVIDER || 'mock';

  // If in mock or development mode or no key provided, log cleanly without secret exposure
  if (provider === 'mock' || !apiKey) {
    const record: EmailDeliveryRecord = {
      orderId: order.id,
      recipientEmail: order.customerEmail,
      sentAt: new Date(),
      status: 'MOCKED',
    };
    emailDeliveryLog.set(order.id, record);
    return { success: true, status: 'MOCKED' };
  }

  // Resend transactional email integration
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM_ADDRESS || 'tickets@raasintaal.com',
        to: [order.customerEmail],
        subject: `Gate Pass Confirmed [${order.orderReference}] — Raas in Taal Dandiya Night`,
        html: emailHtml,
      }),
    });

    if (res.ok) {
      emailDeliveryLog.set(order.id, {
        orderId: order.id,
        recipientEmail: order.customerEmail,
        sentAt: new Date(),
        status: 'SENT',
      });
      return { success: true, status: 'SENT' };
    } else {
      const errData = await res.json();
      emailDeliveryLog.set(order.id, {
        orderId: order.id,
        recipientEmail: order.customerEmail,
        sentAt: new Date(),
        status: 'FAILED',
        error: errData.message,
      });
      return { success: false, status: 'FAILED', error: errData.message };
    }
  } catch (err: any) {
    emailDeliveryLog.set(order.id, {
      orderId: order.id,
      recipientEmail: order.customerEmail,
      sentAt: new Date(),
      status: 'FAILED',
      error: err.message,
    });
    return { success: false, status: 'FAILED', error: err.message };
  }
}

export function getEmailDeliveryStatus(orderId: string): EmailDeliveryRecord | undefined {
  return emailDeliveryLog.get(orderId);
}
