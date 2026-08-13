import { Router } from 'express';
import { z } from 'zod';
import { generateCompletion } from '../services/ai.service.js';

const router = Router();
const requestSchema = z.object({ prompt: z.string().min(1).max(12000), provider: z.enum(['groq', 'mistral']).optional() });
router.post('/generate', async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Provide a prompt and an optional valid provider.' });
  try { return response.json(await generateCompletion(parsed.data)); }
  catch (error) { console.error('AI generation failed:', error.message); return response.status(500).json({ error: error.message || 'AI generation failed.' }); }
});
export default router;
