export async function onRequestPost(context) {
  const { daysBack = 14, companies = [] } = await context.request.json();
  const EDINET_KEY = context.env.EDINET_API_KEY;

  const dates = [];
  for (let i = 0; i < Math.min(daysBack, 30); i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const results = [];
  for (const date of dates) {
    try {
      const url = `https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=${date}&type=2&Subscription-Key=${EDINET_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      for (const doc of (data.results || [])) {
        if (doc.docTypeCode !== "140") continue;
        const desc = doc.docDescription || "";
        const keywords = ["役員", "取締役", "就任", "退任", "異動", "監査役"];
        if (!keywords.some(k => desc.includes(k))) continue;

        const matched = companies.length === 0 ||
          companies.some(c => doc.filerName?.includes(c) || c.includes(doc.filerName));

        results.push({
          source: "EDINET",
          docID: doc.docID,
          companyName: doc.filerName,
          personName: "",
          changeType: desc,
          effectiveDate: date,
          filedAt: doc.submitDateTime || date,
          matched,
        });
      }
    } catch (e) {
      console.error(`EDINET error ${date}:`, e.message);
    }
  }

  results.sort((a, b) => (b.matched ? 1 : 0) - (a.matched ? 1 : 0));

  return new Response(JSON.stringify({ results: results.slice(0, 30) }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
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
