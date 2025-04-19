# MCP Servers Collection

A collection of Model Context Protocol (MCP) servers that extend Claude's capabilities with various external integrations.

## What is MCP?

The Model Context Protocol (MCP) allows AI assistants like Claude to interact with external tools and services through standardized interfaces. Each MCP server provides specific functionality that Claude can use to enhance its capabilities.

This project is based on the [Model Context Protocol](https://github.com/anthropics/model-context-protocol) developed by Anthropic, and uses the [TypeScript MCP SDK](https://github.com/anthropics/model-context-protocol-typescript) for implementation.

## Available MCP Servers

| MCP Server | Description | NPM Package |
|------------|-------------|------------|
| Brave Search | Provides web search and local search capabilities using the Brave Search API | [@integrabot/brave-search](https://www.npmjs.com/package/@integrabot/brave-search) |
| Brasil API | Provides access to Brazilian public data (CEP, CNPJ, FIPE) including postal codes, business registry, vehicle pricing and more | [@integrabot/brasil-api](https://www.npmjs.com/package/@integrabot/brasil-api) |
| Google Calendar | Enables interaction with Google Calendar for managing events, viewing calendars, and handling scheduling with support for both OAuth2 and API token authentication | [@integrabot/google-calendar](https://www.npmjs.com/package/@integrabot/google-calendar) |
| Ploomes CRM | Provides integration with Ploomes CRM for managing customers, deals, contacts, and activities | [@integrabot/ploomes-crm](https://www.npmjs.com/package/@integrabot/ploomes-crm) |
| Slack | Enables interaction with Slack workspaces including listing channels, sending messages, replying to threads, adding reactions, and retrieving user profiles | [@integrabot/slack](https://www.npmjs.com/package/@integrabot/slack) |

## Development

To build all MCP servers:

```bash
npm run build
```

To develop and watch for changes:

```bash
npm run watch
```

To publish all packages:

```bash
npm run publish-all
```

## References

- [Model Context Protocol](https://github.com/anthropics/model-context-protocol) - Official MCP specification
- [TypeScript MCP SDK](https://github.com/anthropics/model-context-protocol-typescript) - Official TypeScript implementation
- [Python MCP SDK](https://github.com/anthropics/model-context-protocol-python) - Official Python implementation
- [Reference Servers](https://github.com/anthropics/model-context-protocol-servers) - Collection of reference MCP server implementations

## License

This project is licensed under the MIT License - see the LICENSE file for details. 