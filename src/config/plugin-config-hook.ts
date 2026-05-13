import type { AgentConfig as SDKAgentConfig } from '@opencode-ai/sdk/v2';
import type { AgentDefinition } from '../agents';
import { parseList } from './agent-mcps';
import { AGENT_ALIASES } from './constants';
import {
  applyEffectiveModelArrays,
  buildEffectiveModelArrays,
  buildModelArrayMap,
  buildTuiAgentModels,
} from './model-resolution';
import {
  getActiveRuntimePreset,
  getPreviousRuntimePreset,
} from './runtime-preset';
import type { AgentOverrideConfig, PluginConfig } from './schema';

type LogFn = (message: string, data?: unknown) => void;

type RegisterCommandFn = (opencodeConfig: Record<string, unknown>) => void;

export type ConfigureOpenCodeConfigOptions = {
  opencodeConfig: Record<string, unknown>;
  config: PluginConfig;
  agents: Record<string, SDKAgentConfig>;
  agentDefs: AgentDefinition[];
  mcps: Record<string, unknown>;
  runtimeChains: Record<string, string[]>;
  recordTuiModels: (input: { agentModels: Record<string, string> }) => void;
  registerCommands: RegisterCommandFn[];
  log?: LogFn;
};

function configAgentMap(
  opencodeConfig: Record<string, unknown>,
): Record<string, unknown> {
  return opencodeConfig.agent as Record<string, unknown>;
}

function mergeAgentConfigs(
  opencodeConfig: Record<string, unknown>,
  agents: Record<string, SDKAgentConfig>,
): Record<string, unknown> {
  if (!opencodeConfig.agent) {
    opencodeConfig.agent = { ...agents };
    return configAgentMap(opencodeConfig);
  }

  const configAgent = configAgentMap(opencodeConfig);
  for (const [name, pluginAgent] of Object.entries(agents)) {
    const existing = configAgent[name] as Record<string, unknown> | undefined;
    if (existing) {
      configAgent[name] = {
        ...pluginAgent,
        ...existing,
      };
    } else {
      configAgent[name] = {
        ...pluginAgent,
      };
    }
  }

  return configAgent;
}

function applyRuntimePresetOverride(
  configAgent: Record<string, unknown>,
  config: PluginConfig,
  log?: LogFn,
): void {
  const runtimePresetName = getActiveRuntimePreset();
  if (!runtimePresetName || !config.presets?.[runtimePresetName]) {
    return;
  }

  const runtimePreset = config.presets[runtimePresetName];
  for (const [agentName, override] of Object.entries(runtimePreset)) {
    const resolvedName = AGENT_ALIASES[agentName] ?? agentName;
    const entry = configAgent[resolvedName] as
      | Record<string, unknown>
      | undefined;
    if (!entry) continue;

    if (typeof override.model === 'string') {
      entry.model = override.model;
    } else if (Array.isArray(override.model) && override.model.length > 0) {
      const first = override.model[0];
      entry.model = typeof first === 'string' ? first : first.id;
      if (typeof first !== 'string' && first.variant) {
        entry.variant = first.variant;
      }
    }
    if (typeof override.variant === 'string') {
      entry.variant = override.variant;
    } else if ('variant' in override) {
      delete entry.variant;
    }
    if (typeof override.temperature === 'number') {
      entry.temperature = override.temperature;
    } else if ('temperature' in override) {
      delete entry.temperature;
    }
    if (
      override.options &&
      typeof override.options === 'object' &&
      !Array.isArray(override.options)
    ) {
      entry.options = override.options;
    } else if ('options' in override) {
      delete entry.options;
    }
    log?.('[plugin] runtime preset override', {
      preset: runtimePresetName,
      agent: agentName,
      model: entry.model as string,
    });
  }

  resetPreviousRuntimePresetAgents(configAgent, config, runtimePreset, log);
}

function resetPreviousRuntimePresetAgents(
  configAgent: Record<string, unknown>,
  config: PluginConfig,
  runtimePreset: NonNullable<PluginConfig['presets']>[string],
  log?: LogFn,
): void {
  const prevPresetName = getPreviousRuntimePreset();
  if (!prevPresetName || !config.presets?.[prevPresetName]) {
    return;
  }

  const prevPreset = config.presets[prevPresetName];
  const newPresetResolved = new Set(
    Object.keys(runtimePreset).map((key) => AGENT_ALIASES[key] ?? key),
  );

  for (const agentName of Object.keys(prevPreset)) {
    const resolvedName = AGENT_ALIASES[agentName] ?? agentName;
    if (newPresetResolved.has(resolvedName)) continue;

    const entry = configAgent[resolvedName] as
      | Record<string, unknown>
      | undefined;
    if (!entry) continue;

    const baseline = config.agents?.[resolvedName];
    const prevOverride = prevPreset[agentName] as
      | AgentOverrideConfig
      | undefined;
    if (typeof baseline?.model === 'string') {
      entry.model = baseline.model;
    }
    if (typeof baseline?.variant === 'string') {
      entry.variant = baseline.variant;
    } else if (prevOverride && 'variant' in prevOverride) {
      delete entry.variant;
    }
    if (typeof baseline?.temperature === 'number') {
      entry.temperature = baseline.temperature;
    } else if (prevOverride && 'temperature' in prevOverride) {
      delete entry.temperature;
    }
    if (
      baseline?.options &&
      typeof baseline.options === 'object' &&
      !Array.isArray(baseline.options)
    ) {
      entry.options = baseline.options;
    } else if (prevOverride && 'options' in prevOverride) {
      delete entry.options;
    }
    log?.('[plugin] runtime preset reset from previous', {
      previousPreset: prevPresetName,
      agent: resolvedName,
      model: entry.model as string,
    });
  }
}

function mergeMcpConfigs(
  opencodeConfig: Record<string, unknown>,
  mcps: Record<string, unknown>,
): string[] {
  const configMcp = opencodeConfig.mcp as Record<string, unknown> | undefined;
  if (!configMcp) {
    opencodeConfig.mcp = { ...mcps };
  } else {
    Object.assign(configMcp, mcps);
  }

  const mergedMcpConfig = opencodeConfig.mcp as
    | Record<string, unknown>
    | undefined;
  return Object.keys(mergedMcpConfig ?? mcps);
}

function applyMcpPermissions(
  configAgent: Record<string, unknown>,
  agents: Record<string, SDKAgentConfig>,
  allMcpNames: string[],
): void {
  for (const [agentName, agentConfig] of Object.entries(agents)) {
    const agentMcps = (agentConfig as { mcps?: string[] })?.mcps;
    if (!agentMcps) continue;

    if (!configAgent[agentName]) {
      configAgent[agentName] = { ...agentConfig };
    }
    const agentConfigEntry = configAgent[agentName] as Record<string, unknown>;
    const agentPermission = (agentConfigEntry.permission ?? {}) as Record<
      string,
      unknown
    >;

    const allowedMcps = parseList(agentMcps, allMcpNames);

    for (const mcpName of allMcpNames) {
      const sanitizedMcpName = mcpName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const permissionKey = `${sanitizedMcpName}_*`;
      const action = allowedMcps.includes(mcpName) ? 'allow' : 'deny';

      if (!(permissionKey in agentPermission)) {
        agentPermission[permissionKey] = action;
      }
    }

    agentConfigEntry.permission = agentPermission;
  }
}

function registerAutoContinueCommand(
  opencodeConfig: Record<string, unknown>,
): void {
  const configCommand = opencodeConfig.command as
    | Record<string, unknown>
    | undefined;
  if (configCommand?.['auto-continue']) {
    return;
  }

  if (!opencodeConfig.command) {
    opencodeConfig.command = {};
  }
  (opencodeConfig.command as Record<string, unknown>)['auto-continue'] = {
    template: 'Call the auto_continue tool with enabled=true',
    description:
      'Enable auto-continuation — orchestrator keeps working through incomplete todos',
  };
}

export function configureOpenCodeConfig({
  opencodeConfig,
  config,
  agents,
  agentDefs,
  mcps,
  runtimeChains,
  recordTuiModels,
  registerCommands,
  log,
}: ConfigureOpenCodeConfigOptions): void {
  if (
    config.setDefaultAgent !== false &&
    !(opencodeConfig as { default_agent?: string }).default_agent
  ) {
    (opencodeConfig as { default_agent?: string }).default_agent =
      'orchestrator';
  }

  const configAgent = mergeAgentConfigs(opencodeConfig, agents);
  const modelArrayMap = buildModelArrayMap(agentDefs);
  const effectiveArrays = buildEffectiveModelArrays(
    modelArrayMap,
    configAgent,
    config.fallback,
  );
  applyEffectiveModelArrays(configAgent, effectiveArrays, log);
  applyRuntimePresetOverride(configAgent, config, log);

  recordTuiModels({
    agentModels: buildTuiAgentModels(agentDefs, configAgent, runtimeChains),
  });

  const allMcpNames = mergeMcpConfigs(opencodeConfig, mcps);
  applyMcpPermissions(configAgent, agents, allMcpNames);

  registerAutoContinueCommand(opencodeConfig);
  for (const registerCommand of registerCommands) {
    registerCommand(opencodeConfig);
  }
}
