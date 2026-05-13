import { describe, expect, test } from 'bun:test';
import type { AgentDefinition } from '../agents';
import {
  applyEffectiveModelArrays,
  buildEffectiveModelArrays,
  buildModelArrayMap,
  buildRuntimeChains,
  buildTuiAgentModels,
} from './model-resolution';
import type { FailoverConfig, ModelEntry } from './schema';

function agent(
  name: string,
  model?: string,
  modelArray?: ModelEntry[],
): AgentDefinition {
  return {
    name,
    config: {
      model,
      prompt: `${name} prompt`,
    },
    ...(modelArray ? { _modelArray: modelArray } : {}),
  } as AgentDefinition;
}

describe('model array resolution', () => {
  test('uses first model when no provider config exists', () => {
    const configAgent: Record<string, unknown> = {};
    applyEffectiveModelArrays(configAgent, {
      oracle: [
        { id: 'opencode/big-pickle', variant: 'high' },
        { id: 'iflowcn/qwen3-235b-a22b-thinking-2507', variant: 'high' },
      ],
    });

    expect(configAgent.oracle).toEqual({
      model: 'opencode/big-pickle',
      variant: 'high',
    });
  });

  test('uses first model even when other providers are configured', () => {
    const configAgent: Record<string, unknown> = {
      oracle: { provider: 'zai-coding-plan' },
    };

    applyEffectiveModelArrays(configAgent, {
      oracle: [
        { id: 'github-copilot/claude-opus-4.6', variant: 'high' },
        { id: 'zai-coding-plan/glm-5' },
      ],
    });

    expect(configAgent.oracle).toMatchObject({
      model: 'github-copilot/claude-opus-4.6',
      variant: 'high',
    });
  });

  test('ignores empty model arrays', () => {
    const configAgent: Record<string, unknown> = {};

    applyEffectiveModelArrays(configAgent, { oracle: [] });

    expect(configAgent.oracle).toBeUndefined();
  });
});

describe('fallback.chains merging for foreground agents', () => {
  test('primary model wins regardless of provider config', () => {
    const effectiveArrays = buildEffectiveModelArrays(
      {},
      { oracle: { model: 'anthropic/claude-opus-4-5' } },
      {
        enabled: true,
        chains: { oracle: ['openai/gpt-4o'] },
      } as FailoverConfig,
    );

    expect(effectiveArrays.oracle?.map((m) => m.id)).toEqual([
      'anthropic/claude-opus-4-5',
      'openai/gpt-4o',
    ]);
  });

  test('chain is ignored when fallback disabled', () => {
    const effectiveArrays = buildEffectiveModelArrays(
      {},
      { oracle: { model: 'anthropic/claude-opus-4-5' } },
      {
        enabled: false,
        chains: { oracle: ['openai/gpt-4o'] },
      } as FailoverConfig,
    );

    expect(effectiveArrays.oracle).toBeUndefined();
  });

  test('_modelArray entries take precedence and chain appends after', () => {
    const effectiveArrays = buildEffectiveModelArrays(
      {
        oracle: [
          { id: 'anthropic/claude-opus-4-5' },
          { id: 'anthropic/claude-sonnet-4-5' },
        ],
      },
      {},
      {
        enabled: true,
        chains: { oracle: ['openai/gpt-4o'] },
      } as FailoverConfig,
    );

    expect(effectiveArrays.oracle?.map((m) => m.id)).toEqual([
      'anthropic/claude-opus-4-5',
      'anthropic/claude-sonnet-4-5',
      'openai/gpt-4o',
    ]);
  });

  test('duplicate model ids across array and chain are deduplicated', () => {
    const effectiveArrays = buildEffectiveModelArrays(
      {
        oracle: [{ id: 'anthropic/claude-opus-4-5' }, { id: 'openai/gpt-4o' }],
      },
      {},
      {
        enabled: true,
        chains: { oracle: ['openai/gpt-4o', 'google/gemini-pro'] },
      } as FailoverConfig,
    );

    expect(effectiveArrays.oracle?.map((m) => m.id)).toEqual([
      'anthropic/claude-opus-4-5',
      'openai/gpt-4o',
      'google/gemini-pro',
    ]);
  });

  test('no currentModel and no _modelArray with chain still resolves', () => {
    const effectiveArrays = buildEffectiveModelArrays({}, {}, {
      enabled: true,
      chains: {
        oracle: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-5'],
      },
    } as FailoverConfig);

    expect(effectiveArrays.oracle?.map((m) => m.id)).toEqual([
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4-5',
    ]);
  });

  test('built-in provider not skipped when other providers are configured', () => {
    const effectiveArrays = buildEffectiveModelArrays(
      {},
      { oracle: { model: 'github-copilot/claude-opus-4.6' } },
      {
        enabled: true,
        chains: {
          oracle: [
            'github-copilot/gemini-3.1-pro-preview',
            'zai-coding-plan/glm-5',
          ],
        },
      } as FailoverConfig,
    );
    const configAgent: Record<string, unknown> = { oracle: {} };

    applyEffectiveModelArrays(configAgent, effectiveArrays);

    expect(configAgent.oracle).toMatchObject({
      model: 'github-copilot/claude-opus-4.6',
    });
  });
});

describe('runtime chain and TUI model snapshots', () => {
  test('runtime chains seed from _modelArray and append fallback chains', () => {
    const chains = buildRuntimeChains(
      [
        agent('oracle', undefined, [
          { id: 'anthropic/claude-opus-4-5' },
          { id: 'openai/gpt-4o' },
        ]),
      ],
      {
        enabled: true,
        chains: {
          oracle: ['openai/gpt-4o', 'google/gemini-pro'],
          explorer: ['openai/gpt-4o-mini'],
        },
      } as FailoverConfig,
    );

    expect(chains).toEqual({
      oracle: [
        'anthropic/claude-opus-4-5',
        'openai/gpt-4o',
        'google/gemini-pro',
      ],
      explorer: ['openai/gpt-4o-mini'],
    });
  });

  test('model array map only includes configured priority arrays', () => {
    expect(
      buildModelArrayMap([
        agent('oracle', 'openai/gpt-4o'),
        agent('explorer', undefined, [{ id: 'openai/gpt-4o-mini' }]),
      ]),
    ).toEqual({
      explorer: [{ id: 'openai/gpt-4o-mini' }],
    });
  });

  test('TUI snapshot skips councillor and falls back to chain then default', () => {
    const models = buildTuiAgentModels(
      [
        agent('orchestrator'),
        agent('oracle', 'openai/gpt-4o'),
        agent('explorer'),
        agent('councillor', 'openai/gpt-4o-mini'),
      ],
      { oracle: { model: 'anthropic/claude-opus-4-5' } },
      { explorer: ['openai/gpt-4o-mini'] },
    );

    expect(models).toEqual({
      orchestrator: 'default',
      oracle: 'anthropic/claude-opus-4-5',
      explorer: 'openai/gpt-4o-mini',
    });
  });
});
