import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_WORKLOG_DATABASE_ID || process.env.NOTION_DATABASE_ID;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const {
      date,
      weekday,
      weatherText,
      highTemp,
      lowTemp,
      workContent,
      submittedAt
    } = req.body || {};

    if (!date) {
      return res.status(400).json({ error: "缺少必填字段：日期" });
    }

    const properties = {
      "日期": {
        title: [{ type: "text", text: { content: String(date) } }]
      },
      "星期": weekday
        ? { rich_text: [{ type: "text", text: { content: String(weekday) } }] }
        : { rich_text: [] },
      "天气": weatherText
        ? { rich_text: [{ type: "text", text: { content: String(weatherText) } }] }
        : { rich_text: [] },
      "最高气温": Number.isFinite(highTemp)
        ? { number: Number(highTemp) }
        : { number: null },
      "最低气温": Number.isFinite(lowTemp)
        ? { number: Number(lowTemp) }
        : { number: null },
      "工作内容": workContent
        ? { rich_text: [{ type: "text", text: { content: String(workContent) } }] }
        : { rich_text: [] },
      "提交时间": submittedAt
        ? { rich_text: [{ type: "text", text: { content: String(submittedAt) } }] }
        : { rich_text: [] }
    };

    const resp = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
      children: workContent
        ? [{
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: String(workContent) } }]
            }
          }]
        : []
    });

    return res.status(200).json({ ok: true, pageId: resp.id });

  } catch (e) {
    const msg = e?.body?.message || e.message || String(e);
    console.error("Notion 写入失败:", msg);
    return res.status(500).json({ error: msg });
  }
}
