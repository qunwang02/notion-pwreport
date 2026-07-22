import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_WORKLOG_DATABASE_ID || process.env.NOTION_DATABASE_ID;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// 工作日志预期的列结构
const requiredSchema = {
  "日期": "title",
  "星期": "formula",
  "天气": "rich_text",
  "最高气温": "number",
  "最低气温": "number",
  "工作内容": "rich_text"
};

function getTypeString(propObj) {
  if (!propObj || typeof propObj !== "object") return "unknown";
  const keys = Object.keys(propObj);
  const typeKey = keys.find(k =>
    ["title", "rich_text", "number", "date", "select", "multi_select",
     "status", "people", "files", "url", "email", "phone_number",
     "checkbox", "relation", "formula", "rollup", "created_time",
     "created_by", "last_edited_time", "last_edited_by", "unique_id"].includes(k)
  );
  return typeKey || "unknown";
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

    const db = await notion.databases.retrieve({ database_id: DATABASE_ID });

    const actual = {};
    for (const [name, def] of Object.entries(db.properties || {})) {
      actual[name] = getTypeString(def);
    }

    const checks = [];
    let allPass = true;

    for (const [reqName, reqType] of Object.entries(requiredSchema)) {
      const gotType = actual[reqName];
      if (!gotType) {
        allPass = false;
        checks.push({
          field: reqName,
          expected: reqType,
          actual: null,
          ok: false,
          advice: `❌ 缺少列「${reqName}」（期望类型：${reqType}）。请在数据库中新增该列。`
        });
      } else if (gotType !== reqType) {
        // formula 类型特殊处理
        if (reqName === "星期" && gotType === "formula") {
          checks.push({ field: reqName, expected: reqType, actual: gotType, ok: true });
        } else {
          allPass = false;
          checks.push({
            field: reqName,
            expected: reqType,
            actual: gotType,
            ok: false,
            advice: `❌ 列「${reqName}」类型不匹配：期望 ${reqType}，实际 ${gotType}。`
          });
        }
      } else {
        checks.push({ field: reqName, expected: reqType, actual: gotType, ok: true });
      }
    }

    // 检查是否有额外列（不影响使用，仅提示）
    const extras = Object.keys(actual).filter(k => !requiredSchema[k]);

    return res.status(200).json({
      ok: allPass,
      database: {
        id: db.id,
        title: db.title?.[0]?.plain_text || "未命名"
      },
      checks,
      extras: extras.map(name => ({ field: name, type: actual[name] })),
      hint: allPass
        ? "✅ 所有列配置正确，可以正常提交数据！"
        : "⚠️ 存在列配置问题，请按 advice 修正后重试。"
    });

  } catch (e) {
    const msg = e?.body?.message || e.message || String(e);
    console.error("Health check 失败:", msg);
    return res.status(500).json({ ok: false, error: msg });
  }
}