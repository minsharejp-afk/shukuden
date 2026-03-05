export async function onRequestPost(context) {
  const { daysBack = 30, contacts = [] } = await context.request.json();
  const NEWS_KEY = context.env.NEWS_API_KEY;
  const ANTHROPIC_KEY = context.env.ANTHROPIC_API_KEY;

  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().split("T")[0];

  const allArticles = [];

  for (const contact of contacts.slice(0, 4)) {
    try {
      const q = encodeURIComponent(
        `"${contact.company}" (執行役員 OR 取締役 OR 就任 OR 昇格 OR 人事異動)`
      );
      const url = `https://newsapi.org/v2/everything?q=${q}&from=${fromStr}&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      for (const article of (data.articles || []).slice(0, 3)) {
        allArticles.push({ article, contact });
      }
    } catch (e) {
      console.error(`NewsAPI error:`, e.message);
    }
  }

  if (allArticles.length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const summaries = allArticles.map(({ article, contact }, i) =>
    `[${i}] 企業:${contact.company} タイトル:${article.title} 概要:${article.description || ""} URL:${article.url} 日付:${article.publishedAt}`
  ).join("\n");

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `以下のニュース記事から人事異動・役員就任・昇格の情報を抽出してください。\n\n${summaries}\n\n人事情報がある記事のみ、以下のJSON配列で返してください:\n[{"index":0,"companyName":"会社名","personName":"人物名(不明なら空文字)","changeType":"就任した役職や変更内容","effectiveDate":"YYYY-MM-DD","url":"記事URL"}]\n\n人事情報がない記事は含めないでください。JSONのみ返してください。`,
        }],
      }),
    });

    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || "[]";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    const results = parsed.map(item => {
      const orig = allArticles[item.index];
      return {
        source: "NewsAPI",
        docID: `news-${Date.now()}-${item.index}`,
        companyName: item.companyName,
        personName: item.personName || "",
        changeType: item.changeType,
        effectiveDate: item.effectiveDate || fromStr,
        filedAt: orig?.article?.publishedAt || new Date().toISOString(),
        articleUrl: orig?.article?.url || "",
        articleTitle: orig?.article?.title || "",
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ results: [], error: e.message }), {
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
