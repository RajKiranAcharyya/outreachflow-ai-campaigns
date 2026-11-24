export interface ContactData {
  first_name?: string;
  last_name?: string;
  company?: string;
  role?: string;
  note?: string;
}

export class GeminiService {
  private apiKey: string;
  private model: string;
  private defaultTimeoutMs: number;
  private defaultRetries: number;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.defaultTimeoutMs = 8000; // 8-second timeout requirement
    this.defaultRetries = 1;
  }

  /**
   * Basic prompt-injection guard that sanitizes contact fields.
   * Strips prompt-injection triggers, instruction overrides, markdown delimiters, and control characters.
   */
  public sanitizeInput(text?: string, maxLength = 80): string {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text
      // Remove known injection patterns (case-insensitive)
      .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)\b/gi, '')
      .replace(/\b(system\s*prompt|system\s*message|developer\s*mode|assistant\s*:)\b/gi, '')
      .replace(/\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\b/gi, '')
      // Remove curly braces, markdown headings, code block fences, script tags
      .replace(/[\{\}\[\]`<>]/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();

    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim();
    }

    return cleaned;
  }

  /**
   * Validates model output to ensure safe, concise, high quality opening lines.
   */
  public validateModelOutput(output: string): boolean {
    if (!output || typeof output !== 'string') return false;

    const trimmed = output.trim();

    // Must be between 10 and 200 characters
    if (trimmed.length < 10 || trimmed.length > 200) {
      return false;
    }

    // Must not contain leaked system tokens, markdown headers, or code blocks
    const forbiddenPatterns = [
      /<[^>]*>/, // HTML tags
      /```/, // Code blocks
      /\b(system\s*prompt|as\s+an\s+ai|language\s+model|i\s+cannot|as\s+requested)\b/i,
      /^#+/m, // Markdown headers
      /[\{\}]/, // Template tags
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deterministic fallback when Gemini API times out, errors, or fails validation.
   */
  public getDeterministicFallback(contact: ContactData): string {
    const firstName = this.sanitizeInput(contact.first_name);
    const company = this.sanitizeInput(contact.company);
    const role = this.sanitizeInput(contact.role);

    if (firstName && company && role) {
      return `Hi ${firstName}, hope things are going great with your role as ${role} at ${company}.`;
    }
    if (firstName && company) {
      return `Hi ${firstName}, hope you and the team at ${company} are having a productive week.`;
    }
    if (company) {
      return `Hope you and the team at ${company} are having a productive week.`;
    }
    if (firstName) {
      return `Hi ${firstName}, hope you are having a productive week.`;
    }
    return `Hope you are having a productive week.`;
  }

  /**
   * Generates a personalized opening line with 8-second timeout, retries, and fallback.
   */
  public async generatePersonalizedOpening(
    contact: ContactData,
    options?: { timeoutMs?: number; retries?: number }
  ): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const maxRetries = options?.retries ?? this.defaultRetries;

    // Sanitize inputs
    const cleanFirstName = this.sanitizeInput(contact.first_name);
    const cleanCompany = this.sanitizeInput(contact.company);
    const cleanRole = this.sanitizeInput(contact.role);
    const cleanNote = this.sanitizeInput(contact.note, 100);

    // If API key is missing or placeholder, immediately return deterministic fallback
    if (!this.apiKey || this.apiKey.includes('YOUR_GEMINI_API_KEY')) {
      return this.getDeterministicFallback(contact);
    }

    const prompt = `You are an expert sales copywriter. Write a single, warm, natural 1-sentence opening line for a cold email.
Recipient details:
- Name: ${cleanFirstName || 'Professional'}
- Company: ${cleanCompany || 'their company'}
- Role: ${cleanRole || 'leader'}
- Note: ${cleanNote || 'none'}

Rules:
- Exactly 1 sentence.
- Under 150 characters.
- Do NOT include quotation marks, greetings like "Subject:" or placeholders.
- Output ONLY the opening line.`;

    let attempts = 0;
    while (attempts <= maxRetries) {
      attempts++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 60,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`Gemini API returned status ${response.status}`);
        }

        const data: any = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (candidateText && this.validateModelOutput(candidateText)) {
          return candidateText.replace(/^["']|["']$/g, '');
        }

        // Output failed validation
        break;
      } catch (err: any) {
        clearTimeout(timer);
        if (attempts > maxRetries) {
          break;
        }
        // Small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    return this.getDeterministicFallback(contact);
  }
}

export const geminiService = new GeminiService();
