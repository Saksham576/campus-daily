/** Gemini call with one retry on rate limits / overload, and the real error in the logs. */
export async function geminiJson(prompt: string, opts: { temperature?: number } = {}): Promise<{ ok: true; text: string } | { ok: false; status: number; detail: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: 500, detail: "GEMINI_API_KEY missing" };
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: opts.temperature ?? 0.2 },
      }),
    });
    if (res.ok) {
      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
      if (text) return { ok: true, text };
      const why = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "empty";
      console.error("gemini empty reply:", why);
      return { ok: false, status: 200, detail: `empty (${why})` };
    }
    const detail = (await res.text().catch(() => "")).slice(0, 400);
    console.error(`gemini ${res.status} (attempt ${attempt + 1}):`, detail);
    if (![429, 500, 503].includes(res.status)) return { ok: false, status: res.status, detail };
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    if (attempt === 2) return { ok: false, status: res.status, detail };
  }
  return { ok: false, status: 0, detail: "unreachable" };
}
