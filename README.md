# Slack Standup Bot

A Slack bot similar to Geekbot that automatically asks team members for daily updates and posts them to a notifications channel.

## Features

- 🤖 Automatically sends daily standup questions to team members via DM
- 📊 Collects responses through an interactive modal
- 📢 Posts all updates to a designated notifications channel
- ⏰ Configurable schedule (default: 9 AM on weekdays)
- 💬 Manual trigger via `/standup` slash command
- 🎨 Beautiful formatted updates with user information

## Setup Instructions

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Give your app a name (e.g., "Standup Bot") and select your workspace
4. Click **"Create App"**

### 2. Configure Bot Permissions

1. Go to **"OAuth & Permissions"** in the left sidebar
2. Scroll down to **"Scopes"** → **"Bot Token Scopes"**
3. Add the following scopes:
   - `chat:write` - Send messages as the bot
   - `users:read` - View users in the workspace
   - `commands` - Add slash commands
   - `im:write` - Send direct messages
   - `channels:read` - View basic channel info

### 3. Enable Socket Mode

1. Go to **"Socket Mode"** in the left sidebar
2. Toggle **"Enable Socket Mode"** to ON
3. Give your token a name (e.g., "App Token")
4. Copy the **App Token** (starts with `xapp-`)

### 4. Enable Interactivity

1. Go to **"Interactivity & Shortcuts"** in the left sidebar
2. Toggle **"Interactivity"** to ON
3. For the Request URL, you can put any URL (e.g., `https://example.com`) since we're using Socket Mode

### 5. Create Slash Command

1. Go to **"Slash Commands"** in the left sidebar
2. Click **"Create New Command"**
3. Set the command to `/standup`
4. Add a description: "Trigger daily standup questions manually"
5. Click **"Save"**

### 6. Install App to Workspace

1. Go to **"OAuth & Permissions"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 7. Get Channel ID

1. Open Slack and navigate to your #notifications channel (or create it)
2. Right-click the channel name → **"View channel details"**
3. Scroll down and copy the **Channel ID**

### 8. Get User IDs

1. Right-click on each team member's profile picture in Slack
2. Click **"Copy member ID"**
3. Collect all user IDs you want to ask for updates
4. Note each user's timezone (e.g., America/New_York, Europe/London, Asia/Tokyo)
   - Find timezone names at [Wikipedia TZ Database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

### 9. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your `.env` file with the values you collected:
   ```env
   SLACK_SIGNING_SECRET=your-signing-secret-here
   NOTIFICATIONS_CHANNEL_ID=C01234567890
   STANDUP_SCHEDULE=0 9 * * 1-5
   TARGET_USERS=U01234567890:America/New_York,U09876543210:Europe/London
   ```

   - **SLACK_BOT_TOKEN**: From step 6
   - **SLACK_APP_TOKEN**: From step 3
   - **SLACK_SIGNING_SECRET**: Found in "Basic Information" → "App Credentials"
   - **NOTIFICATIONS_CHANNEL_ID**: From step 7
   - **TARGET_USERS**: Format is `userId:timezone,userId:timezone` from step 8
     - Example: `U01234567890:America/New_York,U09876543210:Europe/London,U11111111111:Asia/Tokyo`
     - If timezone is omitted, defaults to `America/New_York` → "App Credentials"
   - **NOTIFICATIONS_CHANNEL_ID**: From step 7
   - **TARGET_USERS**: Comma-separated user IDs from step 8

### 10. Install Dependencies

```bash
npm install
```

### 11. Build the Project

```bash
npm run build
```

### 12. Run the Bot

Development mode (with auto-restart):
```bash
npm run watch
```

Or simply:
```bash
npm run dev
```

Production mode:
```bash
npm start
## Usage

### Automatic Daily Standup

The bot will automatically send standup questions based on the schedule in your `.env` file. **Each user receives questions at the scheduled time in their own timezone**. For example, if the schedule is set to 9 AM:
- A user in `America/New_York` gets questions at 9 AM EST
- A user in `Europe/London` gets questions at 9 AM GMT
- A user in `Asia/Tokyo` gets questions at 9 AM JST

The bot will automatically send standup questions based on the schedule in your `.env` file. Default is 9 AM on weekdays (Monday-Friday).

### Manual Trigger

Type `/standup` in any Slack channel to manually trigger the standup questions.

### Responding to Questions

1. When the bot sends you a DM, click the **"Submit Daily Update"** button
2. Fill out the modal with:
   - What you accomplished yesterday
   - What you're working on today
   - Any blockers or challenges
3. Click **"Submit"**
4. Your update will be posted to the notifications channel

## Cron Schedule Format

The `STANDUP_SCHEDULE` variable uses cron format:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-7, both 0 and 7 are Sunday)
## Customization

### Change Questions

Edit `src/handlers/standup.ts` to modify the questions in the modal.

### Change Timezone

Edit the `timezone` option in `src/index.ts` (default is `America/New_York`).

### Change Update Format

Modify the message blocks in the `standup_modal` view handler in `src/index.ts`.
### Change Questions

Edit `src/handlers/standup.js` to modify the questions in the modal.

### Change Timezone

Edit the `timezone` option in `src/index.js` (default is `America/New_York`).

### Change Update Format

Modify the message blocks in the `standup_modal` view handler in `src/index.js`.

## Troubleshooting

- **Bot not responding**: Check that Socket Mode is enabled and your App Token is correct
- **Permission errors**: Verify all required bot scopes are added
- **Schedule not working**: Check your cron syntax and timezone setting
- **Can't post to channel**: Make sure the bot is invited to the #notifications channel (`/invite @BotName`)

## License

ISC
