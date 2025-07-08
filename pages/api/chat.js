import { OpenAI } from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { messages } = req.body;
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OpenAI API key' });
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const chat = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
    });
    res.status(200).json({ result: chat.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
