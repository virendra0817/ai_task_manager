import Groq from 'groq-sdk';
import { Mistral } from '@mistralai/mistralai';

const systemPrompt = 'You are a helpful task-management assistant. Return a concise, actionable task with a title, description, suggested priority, and due-date note when one is present.';
const selectedProvider = (provider) => provider || process.env.AI_DEFAULT_PROVIDER || 'groq';

export async function generateCompletion({ prompt, provider }) {
  const selected = selectedProvider(provider);
  if (selected === 'groq') {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured.');
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    });
    return { provider: 'groq', content: completion.choices[0]?.message?.content || '' };
  }
  if (selected === 'mistral') {
    if (!process.env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY is not configured.');
    const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    const completion = await client.chat.complete({
      model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    });
    return { provider: 'mistral', content: completion.choices?.[0]?.message?.content || '' };
  }
  throw new Error(`Unsupported AI provider: ${selected}`);
}
