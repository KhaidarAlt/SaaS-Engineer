// Resend email service integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendPasswordResetEmail(
  toEmail: string, 
  resetLink: string,
  storeName: string = 'SmartCatalog'
) {
  const { client, fromEmail } = await getResendClient();
  
  const result = await client.emails.send({
    from: fromEmail,
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
