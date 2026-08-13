import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import aiRouter from './routes/ai.js';
import authRouter, { requireAuth } from './routes/auth.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../.env') });

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
