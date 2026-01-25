// Gmail SMTP email service
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    
    if (!user || !pass) {
      console.error('[Gmail] GMAIL_USER or GMAIL_APP_PASSWORD not configured');
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be configured');
    }
    
    console.log(`[Gmail] Creating transporter for user: ${user}`);
    
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(
  toEmail: string, 
  resetLink: string,
  storeName: string = 'BotFactory.kz'
) {
  console.log(`[Gmail] Attempting to send password reset email to ${toEmail}`);
  
  try {
    const transport = getTransporter();
    const fromEmail = process.env.GMAIL_USER;
    console.log(`[Gmail] Using sender: ${fromEmail}`);
    
    const result = await transport.sendMail({
      from: `"${storeName}" <${fromEmail}>`,
      to: toEmail,
      subject: `Сброс пароля - ${storeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Сброс пароля</h2>
          <p>Вы запросили сброс пароля для вашего аккаунта в ${storeName}.</p>
          <p>Нажмите на кнопку ниже, чтобы установить новый пароль:</p>
          <p style="margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Сбросить пароль
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Ссылка действительна в течение 1 часа.
          </p>
          <p style="color: #666; font-size: 14px;">
            Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            Это автоматическое сообщение от ${storeName}. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      `
    });
    
    console.log(`[Gmail] Email sent successfully. MessageId: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('[Gmail] Error sending email:', error);
    throw error;
  }
}
