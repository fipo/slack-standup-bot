import "dotenv/config";
import { App } from "@slack/bolt";
import cron from "node-cron";
import { format, getDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { createServer } from "http";
import { askForUpdates, handleUpdateResponse } from "./handlers/standup";

// Type definitions
interface DailyUpdate {
  userId: string;
  timestamp: string;
  yesterday: string;
  today: string;
  blockers: string;
}

interface DailyUpdatesStore {
  [date: string]: DailyUpdate[];
}

interface UserConfig {
  userId: string;
  timezone: string;
}

interface DailyThreadStore {
  [date: string]: string; // Maps date to thread timestamp
}

// Parse TARGET_USERS from env
function parseTargetUsers(): UserConfig[] {
  const targetUsers = process.env.TARGET_USERS;
  if (!targetUsers) return [];

  return targetUsers
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [userId, timezone] = entry.split(":");
      return {
        userId: userId.trim(),
        timezone: timezone?.trim() || "Europe/Sofia",
      };
    });
}

// Check if it's time to send standup for a user
function shouldSendStandupNow(
  userConfig: UserConfig,
  targetHour: number,
  targetMinute: number,
  targetWeekdays: number[]
): boolean {
  const now = new Date();

  // Get time in user's timezone
  const zonedTime = toZonedTime(now, userConfig.timezone);
  const hour = zonedTime.getHours();
  const minute = zonedTime.getMinutes();
  const weekday = getDay(zonedTime); // 0=Sunday, 1=Monday, ..., 6=Saturday

  return (
    hour === targetHour &&
    minute === targetMinute &&
    targetWeekdays.includes(weekday)
  );
}

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: 3000,
});

// Store for collecting responses
const dailyUpdates: DailyUpdatesStore = {};
// Store for daily thread timestamps
const dailyThreads: DailyThreadStore = {};

// Handle interactive messages (button clicks, etc.)
app.action("submit_update", async ({ ack, body, client }) => {
  await ack();
  await handleUpdateResponse(body, client);
});

// Handle slash command for manual triggering
app.command("/standup", async ({ command, ack, client }) => {
  await ack();

  const userConfigs = parseTargetUsers();

  if (userConfigs.length === 0) {
    await client.chat.postMessage({
      channel: command.user_id,
      text: "⚠️ No target users configured. Please set TARGET_USERS in your .env file.",
    });
    return;
  }

  const userIds = userConfigs.map((config) => config.userId);
  await askForUpdates(client, userIds);

  await client.chat.postMessage({
    channel: command.user_id,
    text: `✅ Standup questions sent to ${userIds.length} user(s).`,
  });
});

// Handle modal submissions for standup updates
app.view("standup_modal", async ({ ack, body, view, client }) => {
  await ack();

  const userId = body.user.id;
  const values = view.state.values;

  // Extract responses
  const yesterday =
    values.yesterday_block.yesterday_input.value || "No response";
  const today = values.today_block.today_input.value || "No response";
  const blockers = values.blockers_block.blockers_input.value || "None";

  // Store the update
  const timestamp = new Date();
  const dateKey = format(timestamp, "yyyy-MM-dd");

  if (!dailyUpdates[dateKey]) {
    dailyUpdates[dateKey] = [];
  }

  dailyUpdates[dateKey].push({
    userId,
    timestamp: timestamp.toISOString(),
    yesterday,
    today,
    blockers,
  });

  // Get user info
  const userInfo = await client.users.info({ user: userId });
  const userName = userInfo.user
    ? userInfo.user.real_name || userInfo.user.name
    : "Unknown User";

  // Post to notifications channel
  const notificationsChannel = process.env.NOTIFICATIONS_CHANNEL_ID;
  if (!notificationsChannel) {
    console.error(
      "NOTIFICATIONS_CHANNEL_ID is not set in environment variables."
    );
    return;
  }

  // Create or get the daily thread
  if (!dailyThreads[dateKey]) {
    // Create the main daily post
    const result = await client.chat.postMessage({
      channel: notificationsChannel,
      text: `Daily Standup Updates - ${dateKey}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `Update, ${format(new Date(dateKey), "MMM d")}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Find all reports for *Update, ${format(
              new Date(dateKey),
              "MMM d, yyyy"
            )}* in the thread. :thread:`,
          },
        },
      ],
    });

    if (result.ts) {
      dailyThreads[dateKey] = result.ts;
    }
  }

  // Post the user's update as a thread reply
  const threadTs = dailyThreads[dateKey];
  if (threadTs) {
    await client.chat.postMessage({
      channel: notificationsChannel,
      thread_ts: threadTs,
      text: `Update from ${userName}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${userName}`,
            emoji: true,
          },
        },
        {
          type: "section",

          text: {
            type: "mrkdwn",
            text: `*Yesterday:*\n${yesterday}`,
          },
        },
        {
          type: "section",

          text: {
            type: "mrkdwn",
            text: `*Today:*\n${today}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Blockers:*\n${blockers}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_Submitted at ${format(new Date(), "PPpp")}_`,
            },
          ],
        },
      ],
    });
  }

  // Send confirmation to user
  await client.chat.postMessage({
    channel: userId,
    text: "✅ Your daily update has been submitted and posted to the notifications channel!",
  });
});

// Schedule daily standup questions
const scheduleExpression = process.env.STANDUP_SCHEDULE || "0 9 * * 1-5";

// Parse schedule to extract hour, minute, and weekdays
const scheduleParts = scheduleExpression.split(" ");
const targetMinute = parseInt(scheduleParts[0]);
const targetHour = parseInt(scheduleParts[1]);
const weekdayPart = scheduleParts[4];

// Parse weekdays from cron expression
let targetWeekdays: number[];
if (weekdayPart === "*") {
  targetWeekdays = [0, 1, 2, 3, 4, 5, 6]; // All days
} else if (weekdayPart.includes("-")) {
  const [start, end] = weekdayPart.split("-").map(Number);
  targetWeekdays = Array.from({ length: end - start + 1 }, (_, i) => start + i);
} else if (weekdayPart.includes(",")) {
  targetWeekdays = weekdayPart.split(",").map(Number);
} else {
  targetWeekdays = [parseInt(weekdayPart)];
}

// Run every hour to check if it's time to send standup for any user
cron.schedule("0 * * * *", async () => {
  const userConfigs = parseTargetUsers();

  if (userConfigs.length === 0) {
    return;
  }

  // Check which users should receive standup now
  const usersToNotify = userConfigs.filter((config) =>
    shouldSendStandupNow(config, targetHour, targetMinute, targetWeekdays)
  );

  if (usersToNotify.length > 0) {
    console.log(
      `Running scheduled standup for ${usersToNotify.length} user(s)...`
    );

    try {
      const userIds = usersToNotify.map((config) => config.userId);
      await askForUpdates(app.client, userIds);
      console.log(
        `Standup questions sent to: ${usersToNotify
          .map((u) => `${u.userId} (${u.timezone})`)
          .join(", ")}`
      );
    } catch (error) {
      console.error("Error sending standup questions:", error);
    }
  }
});

// Start the app
(async () => {
  await app.start();
  console.log("⚡️ Slack Standup Bot is running!");
  console.log(`📅 Scheduled standup: ${scheduleExpression}`);

  const userConfigs = parseTargetUsers();
  console.log(`👥 Target users: ${userConfigs.length}`);
  if (userConfigs.length > 0) {
    console.log("📍 User timezones:");
    userConfigs.forEach((config) => {
      console.log(`   - ${config.userId}: ${config.timezone}`);
    });
  }

  // Create HTTP server for Render health checks
  const PORT = process.env.PORT || 3000;
  const server = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(PORT, () => {
    console.log(`🌐 HTTP server listening on port ${PORT}`);
  });
})();
