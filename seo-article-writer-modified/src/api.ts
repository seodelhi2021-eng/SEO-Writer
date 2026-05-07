// Multi-provider LLM wrapper. Each call is INDEPENDENT — no conversation chaining.
// Supports Anthropic Claude and DeepSeek behind a single function.

export type Provider = 'anthropic' | 'deepseek';

export interface ProviderConfig {
  id: Provider;
  label: string;
  model: string;
  keyPlaceholder: string;
  keyHint: string;
}

// Centralized config — change a model string here and the whole app updates.
export const PROVIDERS: Record<Provider, ProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    model: 'claude-opus-4-5',
    keyPlaceholder: 'sk-ant-...',
    keyHint: "Stored only in your browser's localStorage. Sent only to Anthropic's API."
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    model: 'deepseek-v4-pro',
    keyPlaceholder: 'sk-...',
    keyHint: "Stored only in your browser's localStorage. Sent only to DeepSeek's API."
  }
};

const MAX_TOKENS = 8000;

export async function callLLM(
  provider: Provider,
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  if (!apiKey) throw new Error('API key is required');
  if (!systemPrompt) throw new Error('System prompt is required');
  if (!userMessage) throw new Error('User message is required');

  if (provider === 'anthropic') {
    return callAnthropic(apiKey, systemPrompt, userMessage);
  }
  if (provider === 'deepseek') {
    return callDeepSeek(apiKey, systemPrompt, userMessage);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: PROVIDERS.anthropic.model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    let errMsg = `Anthropic API error: ${response.status}`;
    try {
      const err = await response.json();
      errMsg = err?.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Anthropic API');
  return text;
}

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: PROVIDERS.deepseek.model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    let errMsg = `DeepSeek API error: ${response.status}`;
    try {
      const err = await response.json();
      errMsg = err?.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from DeepSeek API');
  return text;
}
