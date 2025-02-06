import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

interface Message {
  type: 'user' | 'bot';
  content: string;
  options?: string[];
}

interface RequestBody {
  message: string;
  context: Message[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `You are Nova, a flood awareness and emergency response assistant. Your primary goal is to help users with:
1. Understanding flood risks and types
2. Emergency preparedness
3. Local flood alerts and warnings
4. Post-flood recovery guidance
5. Emergency contacts and resources

Keep responses concise, practical, and focused on flood-related information. Always maintain a helpful and reassuring tone.

Current location context: Chennai, Tamil Nadu, India
Emergency contacts:
- Police: 100
- Flood Control: 1913
- Emergency Services: 108`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json() as RequestBody;
    console.log('Received message:', message);
    console.log('Context:', context);

    // Format conversation history for DeepSeek
    const conversationHistory = context.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add system prompt
    conversationHistory.unshift({
      role: 'system',
      content: systemPrompt
    });

    // Add the current message
    conversationHistory.push({
      role: 'user',
      content: message
    });

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!deepseekResponse.ok) {
      const errorData = await deepseekResponse.json();
      console.error('DeepSeek API error:', errorData);
      throw new Error(`DeepSeek API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await deepseekResponse.json();
    console.log('DeepSeek response:', data);

    let options: string[] = [
      "Tell me more",
      "What should I do next?",
      "Back to main menu"
    ];

    // Add context-specific options based on the message content
    if (message.toLowerCase().includes('flood risk')) {
      options = [
        "How can I prepare?",
        "Show emergency contacts",
        "Get local alerts"
      ];
    } else if (message.toLowerCase().includes('emergency')) {
      options = [
        "Call emergency services",
        "Evacuation guidelines",
        "Find shelter"
      ];
    }

    const aiMessage: Message = {
      type: 'bot',
      content: data.choices[0].message.content,
      options
    };

    return new Response(JSON.stringify(aiMessage), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get response. Please try again.',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});