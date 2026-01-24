// Resend email service integration
// Uses direct RESEND_API_KEY from environment secrets
import { Resend } from 'resend';

const FROM_EMAIL = 'onboarding@resend.dev';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured. Please add it to secrets.');
  }
  return new Resend(apiKey);
}

export async function sendPasswordResetEmail(
  toEmail: string, 
  resetLink: string,
  storeName: string = 'SmartCatalog'
) {
  const client = getResendClient();
  
  const result = await client.emails.send({
    from: FROM_EMAIL,
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
  
  return result;
}
