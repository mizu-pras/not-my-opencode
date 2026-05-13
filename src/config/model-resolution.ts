import type { AgentDefinition } from '../agents';
import type { FailoverConfig, ModelEntry } from './schema';

type ConfigAgentMap = Record<string, unknown>;
type LogFn = (message: string, data?: unknown) => void;

function hasModelArray(
  agentDef: AgentDefinition,
): agentDef is AgentDefinition & { _modelArray: ModelEntry[] } {
  return Array.isArray(agentDef._modelArray) && agentDef._modelArray.length > 0;
}

export function buildModelArrayMap(
  agentDefs: AgentDefinition[],
): Record<string, ModelEntry[]> {
  const modelArrayMap: Record<string, ModelEntry[]> = {};

  for (const agentDef of agentDefs) {
    if (hasModelArray(agentDef)) {
      modelArrayMap[agentDef.name] = agentDef._modelArray;
    }
  }

  return modelArrayMap;
}

export function buildRuntimeChains(
  agentDefs: AgentDefinition[],
  fallback: FailoverConfig | undefined,
): Record<string, string[]> {
  const runtimeChains: Record<string, string[]> = {};

  for (const agentDef of agentDefs) {
    if (hasModelArray(agentDef)) {
      runtimeChains[agentDef.name] = agentDef._modelArray.map((m) => m.id);
    }
  }

  if (fallback?.enabled !== false) {
    const chains = fallback?.chains ?? {};
    for (const [agentName, chainModels] of Object.entries(chains)) {
      if (!chainModels?.length) continue;

      const existing = runtimeChains[agentName] ?? [];
      const seen = new Set(existing);
      for (const model of chainModels) {
        if (!seen.has(model)) {
          seen.add(model);
          existing.push(model);
        }
      }
      runtimeChains[agentName] = existing;
    }
  }

  return runtimeChains;
}

export function buildEffectiveModelArrays(
  modelArrayMap: Record<string, ModelEntry[]>,
  configAgent: ConfigAgentMap,
  fallback: FailoverConfig | undefined,
): Record<string, ModelEntry[]> {
  const effectiveArrays: Record<string, ModelEntry[]> = {};

  for (const [agentName, models] of Object.entries(modelArrayMap)) {
    effectiveArrays[agentName] = [...models];
  }

  if (fallback?.enabled === false) {
    return effectiveArrays;
  }

  const fallbackChains = fallback?.chains ?? {};
  for (const [agentName, chainModels] of Object.entries(fallbackChains)) {
    if (!chainModels?.length) continue;

    if (!effectiveArrays[agentName]) {
      const entry = configAgent[agentName] as
        | Record<string, unknown>
        | undefined;
      const currentModel =
        typeof entry?.model === 'string' ? entry.model : undefined;
      effectiveArrays[agentName] = currentModel ? [{ id: currentModel }] : [];
    }

    const seen = new Set(effectiveArrays[agentName].map((m) => m.id));
    for (const chainModel of chainModels) {
      if (!seen.has(chainModel)) {
        seen.add(chainModel);
        effectiveArrays[agentName].push({ id: chainModel });
      }
    }
  }

  return effectiveArrays;
}

export function applyEffectiveModelArrays(
  configAgent: ConfigAgentMap,
  effectiveArrays: Record<string, ModelEntry[]>,
  log?: LogFn,
): void {
  for (const [agentName, modelArray] of Object.entries(effectiveArrays)) {
    if (modelArray.length === 0) continue;

    const chosen = modelArray[0];
    const entry = configAgent[agentName] as Record<string, unknown> | undefined;
    if (entry) {
      entry.model = chosen.id;
      if (chosen.variant) {
        entry.variant = chosen.variant;
      }
    } else {
      configAgent[agentName] = {
        model: chosen.id,
        ...(chosen.variant ? { variant: chosen.variant } : {}),
      };
    }

    log?.('[plugin] resolved model from array', {
      agent: agentName,
      model: chosen.id,
      variant: chosen.variant,
    });
  }
}

export function buildTuiAgentModels(
  agentDefs: AgentDefinition[],
  configAgent: ConfigAgentMap,
  runtimeChains: Record<string, string[]>,
): Record<string, string> {
  const tuiAgentModels: Record<string, string> = {};

  for (const agentDef of agentDefs) {
    if (agentDef.name === 'councillor') continue;

    const entry = configAgent[agentDef.name] as
      | Record<string, unknown>
      | undefined;
    const resolvedModel =
      typeof entry?.model === 'string'
        ? entry.model
        : runtimeChains[agentDef.name]?.[0]
          ? runtimeChains[agentDef.name][0]
          : typeof agentDef.config.model === 'string'
            ? agentDef.config.model
            : undefined;

    tuiAgentModels[agentDef.name] = resolvedModel ?? 'default';
  }

  return tuiAgentModels;
}
