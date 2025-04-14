# Slack MCP Server

**Category: Collaboration**

An MCP server that enables Claude to interact with Slack workspaces, including sending messages, replying to threads, adding reactions, and retrieving user profiles.

## Features

- **Channel Management**: List channels in a workspace with pagination support
- **Messaging**: Send new messages and reply to existing threads
- **Reactions**: Add emoji reactions to messages
- **Conversation Access**: Retrieve channel history and thread replies
- **Search**: Search for messages across all channels
- **User Information**: List users and access detailed profile information

## Tools

### Channel Management
- **slack_list_channels**
  - List public channels in the workspace with pagination
  - Inputs:
    - `limit` (number, optional): Maximum number of channels to return (default 100, max 200)
    - `cursor` (string, optional): Pagination cursor for next page of results

### Messaging
- **slack_post_message**
  - Post a new message to a Slack channel
  - Inputs:
    - `channel_id` (string): The ID of the channel to post to
    - `text` (string): The message text to post

- **slack_reply_to_thread**
  - Reply to a specific message thread in Slack
  - Inputs:
    - `channel_id` (string): The ID of the channel containing the thread
    - `thread_ts` (string): The timestamp of the parent message
    - `text` (string): The reply text

### Reactions
- **slack_add_reaction**
  - Add a reaction emoji to a message
  - Inputs:
    - `channel_id` (string): The ID of the channel containing the message
    - `timestamp` (string): The timestamp of the message to react to
    - `reaction` (string): The name of the emoji reaction (without ::)

### Conversation Access
- **slack_get_channel_history**
  - Get recent messages from a channel
  - Inputs:
    - `channel_id` (string): The ID of the channel
    - `limit` (number, optional): Number of messages to retrieve (default 10)

- **slack_get_thread_replies**
  - Get all replies in a message thread
  - Inputs:
    - `channel_id` (string): The ID of the channel containing the thread
    - `thread_ts` (string): The timestamp of the parent message

### Search
- **slack_search_messages**
  - Search for messages across channels
  - Inputs:
    - `query` (string): The search query
    - `count` (number, optional): Number of results to return (default 5)

### User Information
- **slack_get_users**
  - Get a list of all users in the workspace with their basic profile information
  - Inputs:
    - `cursor` (string, optional): Pagination cursor for next page of results
    - `limit` (number, optional): Maximum number of users to return (default 100, max 200)

- **slack_get_user_profile**
  - Get detailed profile information for a specific user
  - Inputs:
    - `user_id` (string): The ID of the user

## Installation

```bash
npm install -g @integrabot/slack
```

## Usage

### Environment Setup

Before using this MCP server, you need to configure your Slack credentials:

```bash
export SLACK_BOT_TOKEN=xoxb-your-bot-token
export SLACK_USER_TOKEN=xoxp-your-user-token
export SLACK_TEAM_ID=your-team-id
```

### Start the Server

```bash
slack
```

## Configuration

### Getting Slack Tokens

1. Create a Slack App in the [Slack API Console](https://api.slack.com/apps)
2. Add necessary OAuth scopes:
   - `channels:read`, `chat:write`, `reactions:write`, `search:read`, `users:read`
3. Install the app to your workspace
4. Copy the Bot Token (`xoxb-...`) and User Token (`xoxp-...`)
5. Find your Team ID in your workspace settings

## Rate Limits

This server implements rate limiting to respect Slack API's usage limits:
- 5 requests per second
- 80 requests per minute

## Timeouts

This server implements a 15-second timeout on all API requests to prevent blocking.

## License

MIT 