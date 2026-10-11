import { Order, GatePass, EventConfig } from '../db/types';
import { Resend } from 'resend';

export interface EmailDeliveryRecord {
  orderId: string;
  recipientEmail: string;
  sentAt: Date;
  status: 'SENT' | 'FAILED' | 'MOCKED';
  provider?: string;
  resendId?: string;
  error?: string;
}

const emailDeliveryLog: Map<string, EmailDeliveryRecord> = new Map();

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendViaGmail(
  gmailUser: string,
  gmailPass: string,
  order: Order,
  emailHtml: string,
  qrImageUrl: string
): Promise<{ success: boolean; status: 'SENT' | 'FAILED'; provider: string; error?: string }> {
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    await transporter.sendMail({
      from: `"Raas in Taal — Dandiya Night" <${gmailUser}>`,
      to: order.customerEmail,
      subject: `Gate Pass Confirmed [${order.orderReference}] — Raas in Taal Dandiya Night`,
      html: emailHtml,
      attachments: [
        {
          filename: `gate-pass-${order.orderReference}.png`,
          path: qrImageUrl,
        },
      ],
    });

    emailDeliveryLog.set(order.id, {
      orderId: order.id,
      recipientEmail: order.customerEmail,
      sentAt: new Date(),
      status: 'SENT',
      provider: 'gmail_fallback',
    });
    return { success: true, status: 'SENT', provider: 'gmail_fallback' };
  } catch (err: any) {
    emailDeliveryLog.set(order.id, {
      orderId: order.id,
      recipientEmail: order.customerEmail,
      sentAt: new Date(),
      status: 'FAILED',
      provider: 'gmail_fallback',
      error: err.message,
    });
    return { success: false, status: 'FAILED', provider: 'gmail_fallback', error: err.message };
  }
}

/**
 * Sends a confirmation email with gate pass link, event information, and QR scanner code.
 * Safe & idempotent: won't crash payment flow if email fails.
 */
export async function sendTicketConfirmationEmail(params: {
  order: Order;
  pass: GatePass;
  event: EventConfig;
  appBaseUrl: string;
}): Promise<{ success: boolean; status: 'SENT' | 'FAILED' | 'MOCKED'; provider?: string; error?: string }> {
  const { order, pass, event, appBaseUrl } = params;
  const passUrl = `${appBaseUrl}/ticket/${encodeURIComponent(pass.qrToken)}`;

  // Generate high-reliability HTTPS QR Image URL (loads in all email clients without Gmail base64 blocking)
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&color=1A0307&bgcolor=FFFFFF&data=${encodeURIComponent(pass.qrToken)}`;

  const safeCustomerName = escapeHtml(order.customerName);
  const safeOrderReference = escapeHtml(order.orderReference);
  const safeVenue = escapeHtml(event.venue);

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
        <p>Namaste <strong>${safeCustomerName}</strong>,</p>
        <p>Your booking for Jaipur's most vibrant Dandiya night is confirmed!</p>
        
        <div class="card">
          <p><strong>Booking Ref:</strong> ${safeOrderReference}</p>
          <p><strong>Ticket Category:</strong> ${order.categoryCode.toUpperCase()}</p>
          <p><strong>Admitted Attendees:</strong> ${pass.totalAttendees} Person(s)</p>
          <p><strong>Date:</strong> Sunday, 18 October 2026</p>
          <p><strong>Durga Puja:</strong> 5:30 PM | <strong>Dandiya Night:</strong> 6:00 PM</p>
          <p><strong>Venue:</strong> ${safeVenue}</p>
        </div>

        <!-- Official Entry Gate QR Scanner Pass -->
        <div style="text-align: center; margin: 24px 0; background: #1B0207; border: 2px dashed #E5A93C; border-radius: 12px; padding: 20px;">
          <p style="color: #E5A93C; font-size: 13px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 12px 0;">Official Entry Gate QR Scanner Pass</p>
          <div style="display: inline-block; background: #ffffff; padding: 12px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
            <img src="${qrImageUrl}" alt="Gate Pass QR Code" width="220" height="220" style="display: block; width: 220px; height: 220px; margin: 0 auto; border: 0;" />
          </div>
          <p style="color: #FFA347; font-size: 11px; margin-top: 10px; font-family: monospace;">Pass Token: ${pass.qrToken.slice(0, 18)}...</p>
          <p style="color: #FFF9F0; font-size: 12px; margin-top: 6px;">Present this QR code directly to the gate staff for entry.</p>
        </div>

        <div style="text-align: center;">
          <a href="${passUrl}" class="button">Open & Download Mobile Pass</a>
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

  const apiKey = (process.env.EMAIL_API_KEY || '').replace(/['"]/g, '').trim();
  const provider = (process.env.EMAIL_PROVIDER || 'mock').replace(/['"]/g, '').trim().toLowerCase();
  const gmailUser = (process.env.GMAIL_USER || '').replace(/['"]/g, '').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/['"]/g, '').replace(/\s+/g, '').trim();

  // Explicit Gmail provider mode
  if (provider === 'gmail' && gmailUser && gmailPass) {
    return sendViaGmail(gmailUser, gmailPass, order, emailHtml, qrImageUrl);
  }

  // Mock / offline testing mode
  if (provider === 'mock' || (!apiKey && !gmailUser)) {
    const record: EmailDeliveryRecord = {
      orderId: order.id,
      recipientEmail: order.customerEmail,
      sentAt: new Date(),
      status: 'MOCKED',
      provider: 'mock',
    };
    emailDeliveryLog.set(order.id, record);
    return { success: true, status: 'MOCKED', provider: 'mock' };
  }

  // Resend transactional email provider
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const rawFrom = (process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev').replace(/['"]/g, '').trim();
      const fromName = (process.env.EMAIL_FROM_NAME || 'Raas in Taal').replace(/['"]/g, '').trim();
      const formattedFrom = rawFrom.includes('<') ? rawFrom : `${fromName} <${rawFrom}>`;

      const response = await resend.emails.send({
        from: formattedFrom,
        to: [order.customerEmail],
        subject: `Gate Pass Confirmed [${order.orderReference}] — Raas in Taal Dandiya Night`,
        html: emailHtml,
      });

      if (!response.error && response.data?.id) {
        emailDeliveryLog.set(order.id, {
          orderId: order.id,
          recipientEmail: order.customerEmail,
          sentAt: new Date(),
          status: 'SENT',
          provider: 'resend',
          resendId: response.data.id,
        });
        return { success: true, status: 'SENT', provider: 'resend' };
      }

      console.warn(`[Resend] Delivery warning for ${order.customerEmail}:`, response.error?.message);

      // If Resend failed (e.g. unverified custom domain for external recipient) and Gmail fallback is available:
      if (gmailUser && gmailPass) {
        console.info(`[Email] Falling back to Gmail SMTP for ${order.customerEmail}`);
        const fallbackRes = await sendViaGmail(gmailUser, gmailPass, order, emailHtml, qrImageUrl);
        if (fallbackRes.success) {
          return fallbackRes;
        }
      }

      emailDeliveryLog.set(order.id, {
        orderId: order.id,
        recipientEmail: order.customerEmail,
        sentAt: new Date(),
        status: 'FAILED',
        provider: 'resend',
        error: response.error?.message || 'Resend delivery failed',
      });
      return { success: false, status: 'FAILED', provider: 'resend', error: response.error?.message };
    } catch (err: any) {
      console.error(`[Resend] Delivery error for ${order.customerEmail}:`, err.message);

      if (gmailUser && gmailPass) {
        console.info(`[Email] Falling back to Gmail SMTP for ${order.customerEmail}`);
        const fallbackRes = await sendViaGmail(gmailUser, gmailPass, order, emailHtml, qrImageUrl);
        if (fallbackRes.success) {
          return fallbackRes;
        }
      }

      emailDeliveryLog.set(order.id, {
        orderId: order.id,
        recipientEmail: order.customerEmail,
        sentAt: new Date(),
        status: 'FAILED',
        provider: 'resend',
        error: err.message,
      });
      return { success: false, status: 'FAILED', provider: 'resend', error: err.message };
    }
  }

  // Fallback if apiKey not set but Gmail is
  if (gmailUser && gmailPass) {
    return sendViaGmail(gmailUser, gmailPass, order, emailHtml, qrImageUrl);
  }

  return { success: false, status: 'FAILED', error: 'No email service credentials configured' };
}

export function getEmailDeliveryStatus(orderId: string): EmailDeliveryRecord | undefined {
  return emailDeliveryLog.get(orderId);
}

/**
 * Sends a password reset OTP verification code.
 * Safe & time-bound: 5-minute expiry with security warnings.
 */
export async function sendPasswordResetOtpEmail(params: {
  email: string;
  otp: string;
}): Promise<{ success: boolean; status: 'SENT' | 'FAILED' | 'MOCKED'; provider?: string; error?: string }> {
  const { email, otp } = params;
  const safeEmail = escapeHtml(email);
  const safeOtp = escapeHtml(otp);

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset Code — Raas in Taal</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F0205; color: #FAF7F2; margin: 0; padding: 24px; }
        .card { max-width: 520px; margin: 0 auto; background: #1C050A; border: 1px solid #D8A743; border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
        .logo { color: #D8A743; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; text-align: center; margin-bottom: 24px; }
        .otp-box { background: #0A0103; border: 2px dashed #E59837; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #FFCC66; }
        .warning { font-size: 12px; color: #E89088; background: rgba(180, 20, 20, 0.15); border-left: 3px solid #E8505B; padding: 10px 14px; border-radius: 6px; margin: 20px 0; line-height: 1.5; }
        .footer { font-size: 11px; color: #8F7B7B; text-align: center; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Raas in Taal</div>
        <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #FAF7F2; text-align: center;">Password Reset Code</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #D4C5B9; margin: 0 0 16px 0;">
          We received a request to reset the password for your account (<strong>${safeEmail}</strong>). Use the verification code below to complete your password reset:
        </p>

        <div class="otp-box">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #C8B9B0; margin-bottom: 6px;">Your 6-Digit OTP</div>
          <div class="otp-code">${safeOtp}</div>
          <div style="font-size: 12px; color: #D8A743; margin-top: 6px; font-weight: 600;">Valid for 5 minutes only</div>
        </div>

        <div class="warning">
          <strong>Security Notice:</strong> Never share this code with anyone. Raas in Taal staff or organizers will never ask for your password or OTP.
        </div>

        <p style="font-size: 12px; color: #A8958E; margin: 0;">
          If you did not request this password reset, you can safely ignore this email. Your current password remains secure.
        </p>

        <div class="footer">
          &copy; 2026 Raas in Taal &bull; Chaos and Chill &bull; Jaipur, Rajasthan
        </div>
      </div>
    </body>
    </html>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  // 1. Try Resend if configured
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const rawFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
      const fromName = (process.env.EMAIL_FROM_NAME || 'Raas in Taal').replace(/['"]/g, '').trim();
      const formattedFrom = rawFrom.includes('<') ? rawFrom : `${fromName} <${rawFrom}>`;

      const response = await resend.emails.send({
        from: formattedFrom,
        to: [email],
        subject: `Password Reset Verification Code — Raas in Taal`,
        html: emailHtml,
      });

      if (!response.error && response.data?.id) {
        return { success: true, status: 'SENT', provider: 'resend' };
      }

      console.warn(`[Resend OTP] Warning for ${email}:`, response.error?.message);
    } catch (err: any) {
      console.error(`[Resend OTP] Error for ${email}:`, err.message);
    }
  }

  // 2. Try Gmail SMTP if configured
  if (gmailUser && gmailPass) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: `"Raas in Taal — Dandiya Night" <${gmailUser}>`,
        to: email,
        subject: `Password Reset Verification Code — Raas in Taal`,
        html: emailHtml,
      });

      return { success: true, status: 'SENT', provider: 'gmail_fallback' };
    } catch (err: any) {
      console.error(`[Gmail OTP] Error for ${email}:`, err.message);
    }
  }

  // 3. Fallback for testing / dev environment
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[Dev OTP Mock] Password reset code for ${email}: ${otp}`);
    return { success: true, status: 'MOCKED', provider: 'dev_mock' };
  }

  return { success: false, status: 'FAILED', error: 'No email service credentials configured' };
}
