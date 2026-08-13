import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../services/database.service.js';
import { sendVerificationEmail } from '../services/mail.service.js';
import crypto from 'node:crypto';

const router = Router();
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8, 'Password must contain at least 8 characters.').max(72),
});

function signToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
    subject: user.id,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(user) {
  return { id: user.id, email: user.email, createdAt: user.created_at, emailVerified: Boolean(user.email_verified_at) };
}

function credentials(request, response) {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.issues[0].message });
    return null;
  }
  return { ...parsed.data, email: parsed.data.email.toLowerCase() };
}

function handleError(error, response) {
  console.error('Authentication failed:', error.message);
  if (error.code === '23505') return response.status(409).json({ error: 'An account with this email already exists.' });
  return response.status(500).json({ error: error.message || 'Authentication failed.' });
}

router.post('/signup', async (request, response) => {
  const input = credentials(request, response);
  if (!input) return;
  try {
    const database = await getDatabase();
    const { rows: existingRows } = await database.query(
      'SELECT id, email, password_hash, created_at, email_verified_at FROM users WHERE email = $1',
      [input.email],
    );
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    const existingUser = existingRows[0];
    if (existingUser) {
      if (existingUser.email_verified_at) {
        return response.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      }
      if (!(await bcrypt.compare(input.password, existingUser.password_hash))) {
        return response.status(409).json({ error: 'An account with this email already exists. Use the original password to resend its verification email.' });
      }
      await database.query(
        `UPDATE users SET verification_token_hash = $1, verification_token_expires_at = NOW() + INTERVAL '24 hours'
         WHERE id = $2`,
        [tokenHash, existingUser.id],
      );
      await sendVerificationEmail(existingUser.email, verificationToken);
      return response.json({ requiresVerification: true, user: publicUser(existingUser) });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const { rows } = await database.query(
      `INSERT INTO users (email, password_hash, verification_token_hash, verification_token_expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       RETURNING id, email, created_at, email_verified_at`,
      [input.email, passwordHash, tokenHash],
    );
    const user = rows[0];
    await sendVerificationEmail(user.email, verificationToken);
    return response.status(201).json({ requiresVerification: true, user: publicUser(user) });
  } catch (error) { return handleError(error, response); }
});

router.post('/login', async (request, response) => {
  const input = credentials(request, response);
  if (!input) return;
  try {
    const database = await getDatabase();
    const { rows } = await database.query(
      'SELECT id, email, password_hash, created_at, email_verified_at FROM users WHERE email = $1',
      [input.email],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return response.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!user.email_verified_at) return response.status(403).json({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' });
    return response.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) { return handleError(error, response); }
});

router.get('/verify-email', async (request, response) => {
  const token = typeof request.query.token === 'string' ? request.query.token : '';
  const redirect = `${process.env.CLIENT_URL || 'http://localhost:5173'}/?verified=`;
  if (!token) return response.redirect(`${redirect}error`);
  try {
    const database = await getDatabase();
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const { rowCount } = await database.query(
      `UPDATE users SET email_verified_at = NOW(), verification_token_hash = NULL, verification_token_expires_at = NULL
       WHERE verification_token_hash = $1 AND verification_token_expires_at > NOW() AND email_verified_at IS NULL`, [hash],
    );
    return response.redirect(`${redirect}${rowCount ? 'success' : 'error'}`);
  } catch (error) { return response.redirect(`${redirect}error`); }
});

export function requireAuth(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ error: 'Authentication is required.' });
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
    request.auth = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_error) { return response.status(401).json({ error: 'Your session is invalid or has expired.' }); }
}

router.get('/me', requireAuth, async (request, response) => {
  try {
    const database = await getDatabase();
    const { rows } = await database.query(
      'SELECT id, email, created_at, email_verified_at FROM users WHERE id = $1',
      [request.auth.sub],
    );
    if (!rows[0]) return response.status(401).json({ error: 'User account no longer exists.' });
    return response.json({ user: publicUser(rows[0]) });
  } catch (error) { return handleError(error, response); }
});

export default router;
