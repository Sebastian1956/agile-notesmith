import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true // Only for development - in production use edge functions
});

export const generateCornellNoteWithAI = async (systemPrompt: string, userContent: string): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || 'Failed to generate content';
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to generate Cornell notes. Please check your API key and try again.');
  }
};