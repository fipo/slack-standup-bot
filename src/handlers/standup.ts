import { App } from "@slack/bolt";

/**
 * Sends standup questions to specified users via DM
 */
export async function askForUpdates(
  client: App["client"],
  userIds: string[]
): Promise<void> {
  for (const userId of userIds) {
    try {
      // Open a modal for the user to fill out
      await client.chat.postMessage({
        channel: userId,
        text: "👋 Good morning! Time for your daily standup update.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "👋 *Good morning!* Time for your daily standup update.",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Click the button below to submit your update:",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "📝 Submit Daily Update",
                  emoji: true,
                },
                style: "primary",
                action_id: "submit_update",
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error(`Error sending message to user ${userId}:`, error);
    }
  }
}

/**
 * Handles when a user clicks the "Submit Update" button
 */
export async function handleUpdateResponse(
  body: any,
  client: App["client"]
): Promise<void> {
  const userId = body.user.id;

  try {
    // Open a modal for the user to fill out their update
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "standup_modal",
        title: {
          type: "plain_text",
          text: "Daily Standup",
        },
        submit: {
          type: "plain_text",
          text: "Submit",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
        blocks: [
          {
            type: "input",
            block_id: "yesterday_block",
            element: {
              type: "plain_text_input",
              action_id: "yesterday_input",
              multiline: true,
            },
            label: {
              type: "plain_text",
              text: "📅 What have you done since yesterday?",
            },
          },
          {
            type: "input",
            block_id: "today_block",
            element: {
              type: "plain_text_input",
              action_id: "today_input",
              multiline: true,
            },
            label: {
              type: "plain_text",
              text: "🎯 What will you do today?",
            },
          },
          {
            type: "input",
            block_id: "blockers_block",
            element: {
              type: "plain_text_input",
              action_id: "blockers_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "(challenges, blockers, ad-hoc tasks, etc.)? If so, please quantify said impact.",
              },
            },
            label: {
              type: "plain_text",
              text: "🚧 Is there any event causing an impact on the plan?",
            },
            optional: true,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error opening modal:", error);
  }
}
