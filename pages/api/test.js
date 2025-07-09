export default async function handler(req, res) {
  res.status(200).json({
    message: 'API is working',
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
} 