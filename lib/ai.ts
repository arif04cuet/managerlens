import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type AIResult = {
  summary: string;
  is_resolved: boolean;
};

export async function analyzeEmailThread(
  subject: string,
  messages: { sender: string; body: string; date: string }[]
): Promise<AIResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const thread = messages
    .map((m) => `[${m.date}] From: ${m.sender}\n${m.body}`)
    .join("\n\n---\n\n");

  const prompt = `You are analyzing an email thread for a manager's tracking board.

Subject: ${subject}

Thread:
${thread}

Respond with valid JSON only — no markdown, no explanation:
{
  "summary": "<1-2 sentence summary of the current status>",
  "is_resolved": <true if the thread is clearly done/approved/closed, otherwise false>
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Failed to parse AI response: ${text}`);
  }
}
