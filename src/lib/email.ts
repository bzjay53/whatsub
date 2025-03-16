import nodemailer from 'nodemailer';

// 이메일 전송을 위한 설정
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    const info = await transporter.sendMail({
      from: `"WhatsUb" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });

    console.log('이메일 전송 성공:', info.messageId);
    return true;
  } catch (error) {
    console.error('이메일 전송 실패:', error);
    return false;
  }
}

export function generatePasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;

  return {
    subject: '[WhatsUb] 비밀번호 재설정',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4F46E5; text-align: center; font-size: 24px;">WhatsUb</h1>
        <p style="margin: 20px 0;">안녕하세요,</p>
        <p>비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새로운 비밀번호를 설정하실 수 있습니다.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            비밀번호 재설정
          </a>
        </div>
        <p style="margin: 20px 0;">이 링크는 1시간 동안만 유효합니다.</p>
        <p>비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eaeaea;" />
        <p style="color: #666; font-size: 12px; text-align: center;">
          본 메일은 발신 전용입니다. 문의사항이 있으시면 고객센터를 이용해 주세요.
        </p>
      </div>
    `,
  };
} 