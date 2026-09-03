// Bridges the in-app Help chat to the official @ColorWinChats Telegram bot.
// Messages are always stored in the database (so the admin panel sees them);
// forwarding to Telegram happens additionally whenever the bot connection and
// support chat id are configured.

export const TELEGRAM_SUPPORT_HANDLE = "@ColorWinChats";
export const TELEGRAM_SUPPORT_URL = "https://t.me/ColorWinChats";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

export function telegramConfigured(): boolean {
  return Boolean(
    process.env["LOVABLE_API_KEY"] &&
      process.env["TELEGRAM_API_KEY"] &&
      process.env["TELEGRAM_SUPPORT_CHAT_ID"],
  );
}

/** Forwards a support message to the ColorWinChats bot. Never throws. */
export async function forwardToTelegram(text: string): Promise<string | null> {
  if (!telegramConfigured()) return null;
  try {
    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
        "X-Connection-Api-Key": process.env["TELEGRAM_API_KEY"]!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: process.env["TELEGRAM_SUPPORT_CHAT_ID"],
        text,
        parse_mode: "HTML",
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`Telegram gateway failed [${res.status}]: ${body}`);
      return null;
    }
    const payload = JSON.parse(body) as { ok?: boolean; error?: string; result?: { message_id?: number } };
    if (!payload.ok) {
      console.error(`Telegram API error: ${payload.error ?? body}`);
      return null;
    }
    return payload.result?.message_id ? String(payload.result.message_id) : null;
  } catch (error) {
    console.error("Telegram forward error", error);
    return null;
  }
}
