import { describe, expect, test } from 'bun:test';
import { createBuiltinMcps } from './index';
import { createWebsearchConfig } from './websearch';

describe('createBuiltinMcps', () => {
  test('returns all MCPs when no disabled list provided', () => {
    const mcps = createBuiltinMcps();
    const names = Object.keys(mcps);

    expect(names).toContain('websearch');
    expect(names).toContain('context7');
    expect(names).toContain('grep_app');
  });

  test('returns all MCPs with empty disabled list', () => {
    const mcps = createBuiltinMcps([]);
    const names = Object.keys(mcps);

    expect(names.length).toBe(3);
    expect(names).toContain('websearch');
    expect(names).toContain('context7');
    expect(names).toContain('grep_app');
  });

  test('excludes single disabled MCP', () => {
    const mcps = createBuiltinMcps(['websearch']);
    const names = Object.keys(mcps);

    expect(names).not.toContain('websearch');
    expect(names).toContain('context7');
    expect(names).toContain('grep_app');
  });

  test('excludes multiple disabled MCPs', () => {
    const mcps = createBuiltinMcps(['websearch', 'grep_app']);
    const names = Object.keys(mcps);

    expect(names).not.toContain('websearch');
    expect(names).not.toContain('grep_app');
    expect(names).toContain('context7');
    expect(names.length).toBe(1);
  });

  test('excludes all MCPs when all disabled', () => {
    const mcps = createBuiltinMcps(['websearch', 'context7', 'grep_app']);
    const names = Object.keys(mcps);

    expect(names.length).toBe(0);
  });

  test('ignores unknown MCP names in disabled list', () => {
    const mcps = createBuiltinMcps(['unknown_mcp', 'nonexistent']);
    const names = Object.keys(mcps);

    // All valid MCPs should still be present
    expect(names.length).toBe(3);
    expect(names).toContain('websearch');
    expect(names).toContain('context7');
    expect(names).toContain('grep_app');
  });

  test('MCP configs have required properties', () => {
    const mcps = createBuiltinMcps();

    for (const [_name, config] of Object.entries(mcps)) {
      expect(config).toBeDefined();
      // Each MCP should have either url (remote) or command (local)
      const hasUrl = 'url' in config;
      const hasCommand = 'command' in config;
      expect(hasUrl || hasCommand).toBe(true);
    }
  });

  test('websearch MCP has correct structure', () => {
    const mcps = createBuiltinMcps();
    const websearch = mcps.websearch;

    expect(websearch).toBeDefined();
    expect('url' in websearch).toBe(true);
  });

  test('brave websearch provider uses official local MCP server', () => {
    const previous = process.env.BRAVE_API_KEY;
    process.env.BRAVE_API_KEY = 'test-key';

    try {
      const websearch = createWebsearchConfig({ provider: 'brave' });

      expect(websearch.type).toBe('local');
      expect('command' in websearch).toBe(true);
      if ('command' in websearch) {
        expect(websearch.command).toEqual([
          'npx',
          '-y',
          '@brave/brave-search-mcp-server',
          '--transport',
          'stdio',
        ]);
        expect(websearch.environment?.BRAVE_API_KEY).toBe('test-key');
      }
    } finally {
      if (previous === undefined) {
        delete process.env.BRAVE_API_KEY;
      } else {
        process.env.BRAVE_API_KEY = previous;
      }
    }
  });

  test('brave websearch provider requires an API key', () => {
    const previous = process.env.BRAVE_API_KEY;
    delete process.env.BRAVE_API_KEY;

    try {
      expect(() => createWebsearchConfig({ provider: 'brave' })).toThrow(
        'BRAVE_API_KEY',
      );
    } finally {
      if (previous !== undefined) process.env.BRAVE_API_KEY = previous;
    }
  });

  test('context7 MCP has correct structure', () => {
    const mcps = createBuiltinMcps();
    const context7 = mcps.context7;

    expect(context7).toBeDefined();
    expect('url' in context7).toBe(true);
  });

  test('grep_app MCP has correct structure', () => {
    const mcps = createBuiltinMcps();
    const grep_app = mcps.grep_app;

    expect(grep_app).toBeDefined();
    expect('url' in grep_app).toBe(true);
  });
});
