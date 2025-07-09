import { OpenAI } from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { messages } = req.body;
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY environment variable');
    return res.status(500).json({ 
      error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.',
      details: 'This error occurs when the OPENAI_API_KEY is not set in your deployment environment.'
    });
  }
  
  try {
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    
    const chat = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
    });
    
    res.status(200).json({ result: chat.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI API error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Error occurred while calling OpenAI API'
    });
  }
}
