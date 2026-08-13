import nodemailer from 'nodemailer';

function verificationUrl(token) {
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(email, token) {
  const url = verificationUrl(token);
  if (!process.env.SMTP_HOST) {
    console.log(`[email verification] SMTP is not configured. Verification link for ${email}: ${url}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Verify your AI Task Manager email',
    text: `Welcome! Verify your email by opening this link: ${url}`,
    html: `<p>Welcome to AI Task Manager.</p><p><a href="${url}">Verify your email address</a></p><p>This link expires in 24 hours.</p>`,
  });
}
