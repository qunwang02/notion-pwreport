import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_WORKLOG_DATABASE_ID || process.env.NOTION_DATABASE_ID;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    if (!DATABASE_ID) {
      return res.status(400).json({
        ok: false,
        error: "缺少环境变量 NOTION_WORKLOG_DATABASE_ID 或 NOTION_DATABASE_ID"
      });
    }

    let allPages = [];
    let cursor = undefined;
    let hasMore = true;

    // 分页查询所有页面
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100, // 每页最多100条
        sorts: [
          {
            property: "日期",
            direction: "descending"
          }
        ]
      });

      allPages = allPages.concat(response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    // 提取关键信息
    const pages = allPages.map(page => {
      const props = page.properties || {};
      return {
        id: page.id,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        url: page.url,
        properties: {
          "日期": props["日期"] || null,
          "星期": props["星期"] || null,
          "天气": props["天气"] || null,
          "最高气温": props["最高气温"] || null,
          "最低气温": props["最低气温"] || null,
          "工作内容": props["工作内容"] || null,
          "提交时间": props["提交时间"] || null
        }
      };
    });

    return res.status(200).json({
      ok: true,
      total: pages.length,
      pages: pages
    });

  } catch (e) {
    const msg = e?.body?.message || e.message || String(e);
    console.error("Notion 查询失败:", msg);

    // 处理常见错误
    if (msg.includes("API token")) {
      return res.status(401).json({
        ok: false,
        error: "Notion API Key 无效或已过期，请检查环境变量 NOTION_API_KEY"
      });
    }
    if (msg.includes("database")) {
      return res.status(404).json({
        ok: false,
        error: "数据库不存在或 Integration 未被授权访问，请检查 NOTION_WORKLOG_DATABASE_ID"
      });
    }

    return res.status(500).json({ ok: false, error: msg });
  }
}
