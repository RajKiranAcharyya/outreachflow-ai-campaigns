import nodemailer from 'nodemailer';

export interface SendResult {
  messageId: string;
  previewUrl: string | null;
  sandbox: boolean;
}

export class EmailSender {
  private transporter: nodemailer.Transporter | null = null;
  private isInitializing: Promise<void> | null = null;

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    if (!this.isInitializing) {
      this.isInitializing = (async () => {
        try {
          // Attempt Ethereal test account with timeout
          const testAccount = await Promise.race([
            nodemailer.createTestAccount(),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error('Ethereal setup timeout')), 3000)
            ),
          ]);

          if (testAccount) {
            this.transporter = nodemailer.createTransport({
              host: 'smtp.ethereal.email',
              port: 587,
              secure: false,
              auth: {
                user: testAccount.user,
                pass: testAccount.pass,
              },
            });
            return;
          }
        } catch {
          // Fall back to json/stream sandbox transport (pure local, zero network needed)
        }

        // Stream transport as completely reliable local sandbox
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: 'windows',
        });
      })();
    }

    await this.isInitializing;
    return this.transporter!;
  }

  /**
   * Dispatches an email in sandbox mode (no real emails sent to external users).
   */
  public async sendSandboxEmail(options: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<SendResult> {
    const transporter = await this.getTransporter();
    const fromAddress = options.from || 'OutreachFlow Sandbox <outreach@sandbox.outreachflow.local>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || `https://ethereal.email/message/${info.messageId}`;

    return {
      messageId: info.messageId,
      previewUrl: previewUrl ? String(previewUrl) : null,
      sandbox: true,
    };
  }
}

export const emailSender = new EmailSender();
