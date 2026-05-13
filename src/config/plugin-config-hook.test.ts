import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { AgentConfig as SDKAgentConfig } from '@opencode-ai/sdk/v2';
import type { AgentDefinition } from '../agents';
import { configureOpenCodeConfig } from './plugin-config-hook';
import {
  rollbackRuntimePreset,
  setActiveRuntimePreset,
  setActiveRuntimePresetWithPrevious,
} from './runtime-preset';
import type { PluginConfig } from './schema';

function agentDef(name: string, model?: string): AgentDefinition {
  return {
    name,
    config: {
      model,
      prompt: `${name} prompt`,
    },
  } as AgentDefinition;
}

function sdkAgent(
  model: string,
  extra: Partial<SDKAgentConfig> = {},
): SDKAgentConfig {
  return {
    model,
    prompt: 'prompt',
    ...extra,
  } as SDKAgentConfig;
}

function configure(opts: {
  opencodeConfig?: Record<string, unknown>;
  config?: PluginConfig;
  agents?: Record<string, SDKAgentConfig>;
  agentDefs?: AgentDefinition[];
  mcps?: Record<string, unknown>;
  runtimeChains?: Record<string, string[]>;
}) {
  const recorded: Array<{ agentModels: Record<string, string> }> = [];
  const register = mock((opencodeConfig: Record<string, unknown>) => {
    opencodeConfig.command = {
      ...((opencodeConfig.command as Record<string, unknown>) ?? {}),
      custom: { template: 'custom', description: 'custom' },
    };
  });
  const opencodeConfig = opts.opencodeConfig ?? {};

  configureOpenCodeConfig({
    opencodeConfig,
    config: opts.config ?? {},
    agents: opts.agents ?? { oracle: sdkAgent('openai/gpt-4o') },
    agentDefs: opts.agentDefs ?? [agentDef('oracle', 'openai/gpt-4o')],
    mcps: opts.mcps ?? {},
    runtimeChains: opts.runtimeChains ?? {},
    recordTuiModels: (input) => recorded.push(input),
    registerCommands: [register],
  });

  return { opencodeConfig, recorded, register };
}

describe('configureOpenCodeConfig', () => {
  afterEach(() => {
    rollbackRuntimePreset(null);
  });

  test('sets orchestrator as default without overwriting user default', () => {
    const first = configure({});
    expect(first.opencodeConfig.default_agent).toBe('orchestrator');

    const second = configure({
      opencodeConfig: { default_agent: 'custom' },
    });
    expect(second.opencodeConfig.default_agent).toBe('custom');
  });

  test('shallow-merges plugin agents while preserving user fields', () => {
    const { opencodeConfig } = configure({
      opencodeConfig: {
        agent: {
          oracle: {
            model: 'user/model',
            permission: { bash: 'deny' },
          },
        },
      },
      agents: {
        oracle: sdkAgent('plugin/model', { temperature: 0.2 }),
      },
    });

    expect((opencodeConfig.agent as Record<string, unknown>).oracle).toEqual({
      model: 'user/model',
      prompt: 'prompt',
      temperature: 0.2,
      permission: { bash: 'deny' },
    });
  });

  test('resolves priority model arrays and records TUI models', () => {
    const { opencodeConfig, recorded } = configure({
      agents: {
        oracle: sdkAgent('stale/model'),
      },
      agentDefs: [
        {
          ...agentDef('oracle'),
          _modelArray: [
            { id: 'github-copilot/claude-opus-4.6', variant: 'high' },
            { id: 'openai/gpt-4o' },
          ],
        } as AgentDefinition,
      ],
      config: {
        fallback: {
          enabled: true,
          chains: { oracle: ['openai/gpt-4o', 'google/gemini-pro'] },
        },
      } as PluginConfig,
      runtimeChains: {
        oracle: [
          'github-copilot/claude-opus-4.6',
          'openai/gpt-4o',
          'google/gemini-pro',
        ],
      },
    });

    expect((opencodeConfig.agent as Record<string, unknown>).oracle).toEqual(
      expect.objectContaining({
        model: 'github-copilot/claude-opus-4.6',
        variant: 'high',
      }),
    );
    expect(recorded[0]).toEqual({
      agentModels: { oracle: 'github-copilot/claude-opus-4.6' },
    });
  });

  test('applies runtime preset override and clears stale scalar fields', () => {
    setActiveRuntimePreset('lean');
    const { opencodeConfig } = configure({
      opencodeConfig: {
        agent: {
          oracle: {
            model: 'old/model',
            variant: 'high',
            temperature: 0.8,
            options: { reasoning: 'high' },
          },
        },
      },
      config: {
        presets: {
          lean: {
            oracle: {
              model: [{ id: 'new/model', variant: 'low' }],
              variant: undefined,
              temperature: undefined,
              options: undefined,
            },
          },
        },
      } as PluginConfig,
    });

    expect((opencodeConfig.agent as Record<string, unknown>).oracle).toEqual(
      expect.objectContaining({
        model: 'new/model',
      }),
    );
    expect(
      (opencodeConfig.agent as Record<string, Record<string, unknown>>).oracle
        .variant,
    ).toBeUndefined();
    expect(
      (opencodeConfig.agent as Record<string, Record<string, unknown>>).oracle
        .temperature,
    ).toBeUndefined();
    expect(
      (opencodeConfig.agent as Record<string, Record<string, unknown>>).oracle
        .options,
    ).toBeUndefined();
  });

  test('resets agents removed from previous runtime preset to baseline', () => {
    setActiveRuntimePreset('powerful');
    setActiveRuntimePresetWithPrevious('cheap');
    const { opencodeConfig } = configure({
      opencodeConfig: {
        agent: {
          oracle: {
            model: 'cheap/model',
            variant: 'low',
            temperature: 0.2,
          },
          orchestrator: {
            model: 'stale/powerful',
            variant: 'high',
          },
        },
      },
      config: {
        agents: {
          orchestrator: { model: 'baseline/model' },
        },
        presets: {
          cheap: {
            oracle: { model: 'cheap/model' },
          },
          powerful: {
            orchestrator: { model: 'powerful/model', variant: 'high' },
          },
        },
      } as PluginConfig,
      agents: {
        oracle: sdkAgent('cheap/model'),
        orchestrator: sdkAgent('stale/powerful'),
      },
      agentDefs: [agentDef('oracle'), agentDef('orchestrator')],
    });

    expect(
      (opencodeConfig.agent as Record<string, Record<string, unknown>>)
        .orchestrator,
    ).toEqual(
      expect.objectContaining({
        model: 'baseline/model',
      }),
    );
    expect(
      (opencodeConfig.agent as Record<string, Record<string, unknown>>)
        .orchestrator.variant,
    ).toBeUndefined();
  });

  test('merges MCPs and preserves user-defined MCP permissions', () => {
    const { opencodeConfig } = configure({
      opencodeConfig: {
        mcp: { custom: {} },
        agent: {
          oracle: {
            permission: { 'custom_*': 'ask' },
          },
        },
      },
      agents: {
        oracle: sdkAgent('openai/gpt-4o', { mcps: ['websearch'] }),
      },
      mcps: {
        websearch: {},
      },
    });

    expect(opencodeConfig.mcp).toEqual({
      custom: {},
      websearch: {},
    });
    expect(
      (opencodeConfig.agent as Record<string, Record<string, unknown>>).oracle
        .permission,
    ).toEqual({
      'custom_*': 'ask',
      'websearch_*': 'allow',
    });
  });

  test('registers auto-continue and delegated commands', () => {
    const { opencodeConfig, register } = configure({});

    expect(
      (opencodeConfig.command as Record<string, unknown>)['auto-continue'],
    ).toEqual({
      template: 'Call the auto_continue tool with enabled=true',
      description:
        'Enable auto-continuation — orchestrator keeps working through incomplete todos',
    });
    expect((opencodeConfig.command as Record<string, unknown>).custom).toEqual({
      template: 'custom',
      description: 'custom',
    });
    expect(register).toHaveBeenCalledTimes(1);
  });
});
