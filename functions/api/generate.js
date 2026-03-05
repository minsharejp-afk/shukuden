export async function onRequestPost(context) {
  const { contact, alert } = await context.request.json();
  const ANTHROPIC_KEY = context.env.ANTHROPIC_API_KEY;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `以下の情報をもとに、格調高いビジネス祝電文を作成してください。\n\n送り先: ${contact?.name || alert?.personName || "ご担当者"}様\n会社名: ${alert?.companyName}\nお祝い内容: ${alert?.changeType}\n情報ソース: ${alert?.source}（${alert?.effectiveDate}付）\n\n要件：150〜200文字、丁寧で格式ある日本語、今後のご活躍を祈る一文を含める、差出人は「[送り主名]」として記載。文章のみ返してください。`,
        }],
      }),
    });

    const data = await res.json();
    const message = data.content?.[0]?.text || "";
    return new Response(JSON.stringify({ message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}
