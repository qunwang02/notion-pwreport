import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
// 使用独立的环境变量，与功课收集数据库区分
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
      date,        // 日期（必填，作为页面标题）
      weatherText, // 天气状态（如：晴、阴、小雨）
      highTemp,    // 最高气温
      lowTemp,     // 最低气温
      workContent  // 工作内容（多行用 \n 分隔）
    } = req.body || {};

    // 日期作为标题，必填
    if (!date) {
      return res.status(400).json({ error: "缺少必填字段：日期" });
    }

    // 构建 Notion 属性
    const properties = {
      // 日期 → Title 列
      "日期": {
        title: [{ type: "text", text: { content: String(date) } }]
      },
      // 天气 → Text
      "天气": weatherText
        ? { rich_text: [{ type: "text", text: { content: String(weatherText) } }] }
        : { rich_text: [] },
      // 最高气温 → Number
      "最高气温": Number.isFinite(highTemp)
        ? { number: Number(highTemp) }
        : { number: null },
      // 最低气温 → Number
      "最低气温": Number.isFinite(lowTemp)
        ? { number: Number(lowTemp) }
        : { number: null },
      // 工作内容 → Text
      "工作内容": workContent
        ? { rich_text: [{ type: "text", text: { content: String(workContent) } }] }
        : { rich_text: [] }
    };

    // 星期列是 Formula 自动计算，无需手动写入

    // 创建 Notion 页面
    const resp = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
      // 工作内容同时作为页面正文内容
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