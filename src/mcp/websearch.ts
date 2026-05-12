import type { WebsearchConfig } from '../config';
import type { LocalMcpConfig, McpConfig, RemoteMcpConfig } from './types';

/**
 * Creates a websearch MCP config based on the provided configuration.
 * Supports Exa (default), Tavily, and Brave providers.
 * @see https://exa.ai  @see https://tavily.com  @see https://search.brave.com
 */
export function createWebsearchConfig(
  config?: WebsearchConfig,
): RemoteMcpConfig | LocalMcpConfig {
  const provider = config?.provider || 'exa';

  if (provider === 'brave') {
    const braveKey = process.env.BRAVE_API_KEY;
    if (!braveKey) {
      throw new Error(
        'BRAVE_API_KEY environment variable is required for Brave provider',
      );
    }

    return {
      type: 'local',
      command: [
        'npx',
        '-y',
        '@brave/brave-search-mcp-server',
        '--transport',
        'stdio',
      ],
      environment: {
        BRAVE_API_KEY: braveKey,
      },
    };
  }

  if (provider === 'tavily') {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      throw new Error(
        'TAVILY_API_KEY environment variable is required for Tavily provider',
      );
    }
    return {
      type: 'remote',
      url: 'https://mcp.tavily.com/mcp/',
      headers: {
        Authorization: `Bearer ${tavilyKey}`,
      },
      oauth: false,
    };
  }

  // Default: Exa provider
  // Prefer exaApiKey in URL (reliably validated by Exa MCP endpoint)
  // Fall back to anonymous access when no key is available
  const exaKey = process.env.EXA_API_KEY;
  const exaUrl = exaKey
    ? `https://mcp.exa.ai/mcp?tools=web_search_exa&exaApiKey=${encodeURIComponent(exaKey)}`
    : 'https://mcp.exa.ai/mcp?tools=web_search_exa';

  return {
    type: 'remote',
    url: exaUrl,
    oauth: false,
  };
}

// Backward compatibility: default export using default (Exa) config
export const websearch: McpConfig = createWebsearchConfig();
