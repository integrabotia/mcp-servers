#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Esquemas Zod para validação de parâmetros
const listChannelsSchema = z.object({
  limit: z.number().optional().default(100)
    .describe("Maximum number of channels to return (default 100, max 200)"),
  cursor: z.string().optional()
    .describe("Pagination cursor for next page of results")
});

const postMessageSchema = z.object({
  channel_id: z.string()
    .describe("The ID of the channel to post to"),
  text: z.string()
    .describe("The message text to post")
});

const replyToThreadSchema = z.object({
  channel_id: z.string()
    .describe("The ID of the channel containing the thread"),
  thread_ts: z.string()
    .describe("The timestamp of the parent message"),
  text: z.string()
    .describe("The reply text")
});

const addReactionSchema = z.object({
  channel_id: z.string()
    .describe("The ID of the channel containing the message"),
  timestamp: z.string()
    .describe("The timestamp of the message to react to"),
  reaction: z.string()
    .describe("The name of the emoji reaction (without ::)")
});

const getChannelHistorySchema = z.object({
  channel_id: z.string()
    .describe("The ID of the channel"),
  limit: z.number().optional().default(10)
    .describe("Number of messages to retrieve (default 10)")
});

const getThreadRepliesSchema = z.object({
  channel_id: z.string()
    .describe("The ID of the channel containing the thread"),
  thread_ts: z.string()
    .describe("The timestamp of the parent message")
});

const searchMessagesSchema = z.object({
  query: z.string()
    .describe("The search query"),
  count: z.number().optional().default(5)
    .describe("Number of results to return (default 5)")
});

const getUsersSchema = z.object({
  cursor: z.string().optional()
    .describe("Pagination cursor for next page of results"),
  limit: z.number().optional().default(100)
    .describe("Maximum number of users to return (default 100, max 200)")
});

const getUserProfileSchema = z.object({
  user_id: z.string()
    .describe("The ID of the user")
});

// Zod schema types
type ListChannelsParams = z.infer<typeof listChannelsSchema>;
type PostMessageParams = z.infer<typeof postMessageSchema>;
type ReplyToThreadParams = z.infer<typeof replyToThreadSchema>;
type AddReactionParams = z.infer<typeof addReactionSchema>;
type GetChannelHistoryParams = z.infer<typeof getChannelHistorySchema>;
type GetThreadRepliesParams = z.infer<typeof getThreadRepliesSchema>;
type SearchMessagesParams = z.infer<typeof searchMessagesSchema>;
type GetUsersParams = z.infer<typeof getUsersSchema>;
type GetUserProfileParams = z.infer<typeof getUserProfileSchema>;

// Classe para o cliente Slack
class SlackClient {
  private botHeaders: { Authorization: string; "Content-Type": string };
  private userHeaders: { Authorization: string; "Content-Type": string };

  constructor(botToken: string, userToken: string) {
    this.botHeaders = {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    };
    this.userHeaders = {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    };
  }

  async getChannels(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      types: "public_channel",
      exclude_archived: "true",
      limit: Math.min(limit, 200).toString(),
      team_id: process.env.SLACK_TEAM_ID!,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await this.fetchWithTimeout(
      `https://slack.com/api/conversations.list?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  async postMessage(channel_id: string, text: string): Promise<any> {
    const response = await this.fetchWithTimeout(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: this.botHeaders,
        body: JSON.stringify({
          channel: channel_id,
          text: text,
        }),
      }
    );

    return response.json();
  }

  async postReply(
    channel_id: string,
    thread_ts: string,
    text: string
  ): Promise<any> {
    const response = await this.fetchWithTimeout(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: this.botHeaders,
        body: JSON.stringify({
          channel: channel_id,
          thread_ts: thread_ts,
          text: text,
        }),
      }
    );

    return response.json();
  }

  async addReaction(
    channel_id: string,
    timestamp: string,
    reaction: string
  ): Promise<any> {
    const response = await this.fetchWithTimeout(
      "https://slack.com/api/reactions.add",
      {
        method: "POST",
        headers: this.botHeaders,
        body: JSON.stringify({
          channel: channel_id,
          timestamp: timestamp,
          name: reaction,
        }),
      }
    );

    return response.json();
  }

  async getChannelHistory(
    channel_id: string,
    limit: number = 10
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      limit: limit.toString(),
    });

    const response = await this.fetchWithTimeout(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  async getThreadReplies(
    channel_id: string,
    thread_ts: string
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      ts: thread_ts,
    });

    const response = await this.fetchWithTimeout(
      `https://slack.com/api/conversations.replies?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  async searchMessages(query: string, count: number = 5): Promise<any> {
    const params = new URLSearchParams({
      query: query,
      count: count.toString(),
    });

    const response = await this.fetchWithTimeout(
      `https://slack.com/api/search.messages?${params}`,
      { headers: this.userHeaders }
    );

    return response.json();
  }

  async getUsers(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      limit: Math.min(limit, 200).toString(),
      team_id: process.env.SLACK_TEAM_ID!,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await this.fetchWithTimeout(
      `https://slack.com/api/users.list?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  async getUserProfile(user_id: string): Promise<any> {
    const params = new URLSearchParams({
      user: user_id,
      include_labels: "true",
    });

    const response = await this.fetchWithTimeout(
      `https://slack.com/api/users.profile.get?${params}`,
      { headers: this.botHeaders }
    );

    return response.json();
  }

  // Função auxiliar para fetch com timeout
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = 15000
  ): Promise<Response> {
    const controller = new AbortController();
    const { signal } = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// Controle de taxa de requisições
const RATE_LIMIT = {
  perSecond: 5,
  perMinute: 80,
};

let requestCount = {
  second: 0,
  minute: 0,
  lastSecondReset: Date.now(),
  lastMinuteReset: Date.now(),
};

function checkRateLimit() {
  const now = Date.now();
  
  // Reset contador por segundo
  if (now - requestCount.lastSecondReset > 1000) {
    requestCount.second = 0;
    requestCount.lastSecondReset = now;
  }
  
  // Reset contador por minuto
  if (now - requestCount.lastMinuteReset > 60000) {
    requestCount.minute = 0;
    requestCount.lastMinuteReset = now;
  }
  
  if (
    requestCount.second >= RATE_LIMIT.perSecond ||
    requestCount.minute >= RATE_LIMIT.perMinute
  ) {
    throw new Error('Rate limit exceeded. Please try again in a moment.');
  }
  
  requestCount.second++;
  requestCount.minute++;
}

async function main() {
  // Verificar variáveis de ambiente necessárias
  const botToken = process.env.SLACK_BOT_TOKEN;
  const userToken = process.env.SLACK_USER_TOKEN;
  const teamId = process.env.SLACK_TEAM_ID;

  if (!botToken || !userToken || !teamId) {
    console.error(
      "Error: Please set SLACK_BOT_TOKEN, SLACK_USER_TOKEN, and SLACK_TEAM_ID environment variables"
    );
    process.exit(1);
  }

  console.error("Starting Slack MCP Server...");
  
  // Criar instância do servidor MCP
  const mcpServer = new McpServer({
    name: "slack",
    version: "0.0.1",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  // Inicializar cliente Slack
  const slackClient = new SlackClient(botToken, userToken);

  // Registrar ferramentas
  mcpServer.tool(
    "slack_list_channels",
    "List public channels in the workspace with pagination",
    listChannelsSchema.shape,
    async ({ limit, cursor }) => {
      try {
        checkRateLimit();
        const response = await slackClient.getChannels(limit, cursor);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_post_message",
    "Post a new message to a Slack channel",
    postMessageSchema.shape,
    async ({ channel_id, text }) => {
      try {
        checkRateLimit();
        const response = await slackClient.postMessage(channel_id, text);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_reply_to_thread",
    "Reply to a specific message thread in Slack",
    replyToThreadSchema.shape,
    async ({ channel_id, thread_ts, text }) => {
      try {
        checkRateLimit();
        const response = await slackClient.postReply(channel_id, thread_ts, text);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_add_reaction",
    "Add a reaction emoji to a message",
    addReactionSchema.shape,
    async ({ channel_id, timestamp, reaction }) => {
      try {
        checkRateLimit();
        const response = await slackClient.addReaction(channel_id, timestamp, reaction);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_get_channel_history",
    "Get recent messages from a channel",
    getChannelHistorySchema.shape,
    async ({ channel_id, limit }) => {
      try {
        checkRateLimit();
        const response = await slackClient.getChannelHistory(channel_id, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_get_thread_replies",
    "Get all replies in a message thread",
    getThreadRepliesSchema.shape,
    async ({ channel_id, thread_ts }) => {
      try {
        checkRateLimit();
        const response = await slackClient.getThreadReplies(channel_id, thread_ts);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_search_messages",
    "Search for messages across channels",
    searchMessagesSchema.shape,
    async ({ query, count }) => {
      try {
        checkRateLimit();
        const response = await slackClient.searchMessages(query, count);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_get_users",
    "Get a list of all users in the workspace with their basic profile information",
    getUsersSchema.shape,
    async ({ limit, cursor }) => {
      try {
        checkRateLimit();
        const response = await slackClient.getUsers(limit, cursor);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  mcpServer.tool(
    "slack_get_user_profile",
    "Get detailed profile information for a specific user",
    getUserProfileSchema.shape,
    async ({ user_id }) => {
      try {
        checkRateLimit();
        const response = await slackClient.getUserProfile(user_id);
        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  // Conectar servidor ao transporte stdio
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await mcpServer.connect(transport);

  console.error("Slack MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 