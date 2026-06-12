import { config } from "../config.js";
import { log } from "../utils/logger.js";

export async function sendAlert(message: string, data?: unknown) {
  const payload = data ? `${message}\n${JSON.stringify(data).slice(0, 1500)}` : message;
  const tasks: Promise<unknown>[] = [];

  if (config.discordWebhookUrl) {
    tasks.push(fetch(config.discordWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: payload })
    }));
  }

  if (config.telegramBotToken && config.telegramChatId) {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    tasks.push(fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegramChatId, text: payload })
    }));
  }

  if (!tasks.length) return;
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") log("warn", "alert_failed", "Failed to send alert", String(result.reason));
  }
}
