import type { Plugin } from '@opencode-ai/plugin';
import { createAgents, getAgentConfigs, getDisabledAgents } from './agents';
import { buildOrchestratorPrompt } from './agents/orchestrator';
import { deepMerge, loadPluginConfig, type MultiplexerConfig } from './config';
import { buildRuntimeChains } from './config/model-resolution';
import { configureOpenCodeConfig } from './config/plugin-config-hook';
import {
  getActiveRuntimePreset,
  setActiveRuntimePreset,
} from './config/runtime-preset';
import { CouncilManager } from './council';
import {
  createApplyPatchHook,
  createAutoUpdateCheckerHook,
  createChatHeadersHook,
  createDelegateTaskRetryHook,
  createFilterAvailableSkillsHook,
  createJsonErrorRecoveryHook,
  createPhaseReminderHook,
  createPostFileToolNudgeHook,
  createTaskSessionManagerHook,
  createTodoContinuationHook,
  ForegroundFallbackManager,
} from './hooks';
import { processImageAttachments } from './hooks/image-hook';
import { createInterviewManager } from './interview';
import { createBuiltinMcps } from './mcp';
import {
  getMultiplexer,
  MultiplexerSessionManager,
  startAvailabilityCheck,
} from './multiplexer';
import {
  ast_grep_replace,
  ast_grep_search,
  createCouncilTool,
  createPresetManager,
  createReadSessionTool,
  createSubtaskCommandManager,
  createSubtaskState,
  createSubtaskTool,
  createWebfetchTool,
} from './tools';
import { recordTuiAgentModel, recordTuiAgentModels } from './tui-state';
import {
  createDisplayNameMentionRewriter,
  resolveRuntimeAgentName,
} from './utils';
import { initLogger, log } from './utils/logger';
import { SubagentDepthTracker } from './utils/subagent-depth';
import { collapseSystemInPlace } from './utils/system-collapse';

/**
 * Best-effort log to opencode's app logger.
 * Wrapped in try/catch to avoid deadlocking on opencode v1.4.8–v1.4.9
 * where client.app.log() during init triggers a middleware cycle.
 */
async function appLog(
  ctx: Parameters<Plugin>[0],
  level: 'error' | 'warn' | 'info',
  message: string,
): Promise<void> {
  try {
    await ctx.client.app.log({
      body: { service: 'not-my-opencode', level, message },
    });
  } catch {
    // client.app.log may deadlock or be unavailable; stderr is the
    // fallback
    const prefix =
      level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO';
    console.error(`[not-my-opencode] ${prefix}: ${message}`);
  }
}

/** Minimum expected registrations for a healthy plugin load. */
const HEALTH_CHECK = {
  minAgents: 5,
  minTools: 5,
  minMcps: 1,
} as const;

/**
 * Probe jsdom at init time so the first webfetch call doesn't fail
 * silently. Logs a warning if jsdom can't be imported or instantiated,
 * but does not throw; the plugin works without webfetch.
 */
async function probeJSDOM(): Promise<string | null> {
  try {
    const { JSDOM } = await import('jsdom');
    new JSDOM('<!DOCTYPE html><html><body>test</body></html>');
    return null;
  } catch (err) {
    return String(err);
  }
}

// Module-level runtime preset tracking. Survives plugin re-inits triggered
// by client.config.update() → Instance.dispose(). When the plugin function
// re-runs, it checks this variable and applies the runtime preset instead
// of the config file's preset. State lives in config/runtime-preset.ts.

const OhMyOpenCodeLite: Plugin = async (ctx) => {
  const sessionId = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  initLogger(sessionId);

  // Declare variables that must survive the try/catch for the return
  // closure. These are set inside the try block.
  let config: ReturnType<typeof loadPluginConfig>;
  let disabledAgents: Set<string>;
  let agentDefs: ReturnType<typeof createAgents>;
  let agents: ReturnType<typeof getAgentConfigs>;
  let mcps: ReturnType<typeof createBuiltinMcps>;
  let runtimeChains: Record<string, string[]>;
  let multiplexerConfig: MultiplexerConfig;
  let multiplexerEnabled: boolean;
  let depthTracker: SubagentDepthTracker;
  let multiplexerSessionManager: MultiplexerSessionManager;
  let autoUpdateChecker: ReturnType<typeof createAutoUpdateCheckerHook>;
  let phaseReminderHook: ReturnType<typeof createPhaseReminderHook>;
  let filterAvailableSkillsHook: ReturnType<
    typeof createFilterAvailableSkillsHook
  >;
  let sessionAgentMap: Map<string, string>;
  let postFileToolNudgeHook: ReturnType<typeof createPostFileToolNudgeHook>;
  let chatHeadersHook: ReturnType<typeof createChatHeadersHook>;
  let delegateTaskRetryHook: ReturnType<typeof createDelegateTaskRetryHook>;
  let applyPatchHook: ReturnType<typeof createApplyPatchHook>;
  let jsonErrorRecoveryHook: ReturnType<typeof createJsonErrorRecoveryHook>;
  let foregroundFallback: ForegroundFallbackManager;
  let todoContinuationHook: ReturnType<typeof createTodoContinuationHook>;
  let taskSessionManagerHook: ReturnType<typeof createTaskSessionManagerHook>;
  let interviewManager: ReturnType<typeof createInterviewManager>;
  let presetManager: ReturnType<typeof createPresetManager>;
  let councilTools: Record<string, unknown>;
  let webfetch: ReturnType<typeof createWebfetchTool>;
  let rewriteDisplayNameMentions: ReturnType<
    typeof createDisplayNameMentionRewriter
  >;
  let subtaskCommandManager: ReturnType<typeof createSubtaskCommandManager>;
  let subtaskState: ReturnType<typeof createSubtaskState>;

  // Counters for post-init health check (set inside try, checked outside)
  let toolCount = 0;

  try {
    config = loadPluginConfig(ctx.directory);

    // Safety net: if a runtime preset was set via /preset command and
    // OpenCode ever fully re-runs the plugin function (not just the
    // config() hook), override config.preset so agents are created with
    // the correct models. Currently only the config() hook re-runs after
    // Instance.dispose(), so this is a defensive guard.
    const runtimePreset = getActiveRuntimePreset();
    if (runtimePreset && config.presets?.[runtimePreset]) {
      config.preset = runtimePreset;
      // Re-merge runtime preset into config.agents (loadPluginConfig
      // already merged the config-file preset, not the runtime one).
      // Runtime preset is override so it wins over config-file preset.
      const presetAgents = config.presets[runtimePreset];
      config.agents = deepMerge(config.agents, presetAgents);
    } else if (runtimePreset) {
      // Preset was deleted from config since last switch — clear stale state
      setActiveRuntimePreset(null);
    }

    disabledAgents = getDisabledAgents(config);
    rewriteDisplayNameMentions = createDisplayNameMentionRewriter(config);
    agentDefs = createAgents(config);
    agents = getAgentConfigs(config);

    // Build runtime fallback chains for all foreground agents. Each chain
    // is an ordered list of model strings to try when the current model is
    // rate-limited. Seeds from _modelArray entries (when the user
    // configures model as an array), then appends fallback.chains entries.
    runtimeChains = buildRuntimeChains(agentDefs, config.fallback);

    // Parse multiplexer config with defaults
    multiplexerConfig = {
      type: config.multiplexer?.type ?? 'none',
      layout: config.multiplexer?.layout ?? 'main-vertical',
      main_pane_size: config.multiplexer?.main_pane_size ?? 60,
    };

    // Get multiplexer instance for capability checks
    const multiplexer = getMultiplexer(multiplexerConfig);
    multiplexerEnabled =
      multiplexerConfig.type !== 'none' &&
      multiplexer !== null &&
      multiplexer.isInsideSession();

    log('[plugin] initialized with multiplexer config', {
      multiplexerConfig,
      enabled: multiplexerEnabled,
      directory: ctx.directory,
    });

    // Start background availability check if enabled
    if (multiplexerEnabled) {
      startAvailabilityCheck(multiplexerConfig);
    }

    depthTracker = new SubagentDepthTracker();

    // Initialize council tools (only when council is configured)
    councilTools = config.council
      ? createCouncilTool(
          ctx,
          new CouncilManager(ctx, config, depthTracker, multiplexerEnabled),
        )
      : {};

    mcps = createBuiltinMcps(config.disabled_mcps, config.websearch);
    webfetch = createWebfetchTool(ctx);

    // Initialize MultiplexerSessionManager to handle OpenCode's built-in
    // Task tool sessions
    multiplexerSessionManager = new MultiplexerSessionManager(
      ctx,
      multiplexerConfig,
    );

    // Initialize auto-update checker hook
    autoUpdateChecker = createAutoUpdateCheckerHook(ctx, {
      autoUpdate: config.autoUpdate ?? true,
    });

    // Initialize phase reminder hook for workflow compliance
    phaseReminderHook = createPhaseReminderHook();

    // Initialize available skills filter hook
    filterAvailableSkillsHook = createFilterAvailableSkillsHook(ctx, config);

    // Track session → agent mapping for serve-mode system prompt injection
    sessionAgentMap = new Map<string, string>();

    // Initialize post-file-tool nudge hook
    postFileToolNudgeHook = createPostFileToolNudgeHook({
      shouldInject: (sessionID) =>
        sessionAgentMap.get(sessionID) === 'orchestrator',
    });

    chatHeadersHook = createChatHeadersHook(ctx);

    // Initialize delegate-task retry guidance hook
    delegateTaskRetryHook = createDelegateTaskRetryHook(ctx);

    applyPatchHook = createApplyPatchHook(ctx);
    // Initialize JSON parse error recovery hook
    jsonErrorRecoveryHook = createJsonErrorRecoveryHook(ctx);

    // Initialize foreground fallback manager for runtime model switching
    foregroundFallback = new ForegroundFallbackManager(
      ctx.client,
      runtimeChains,
      config.fallback?.enabled !== false &&
        Object.keys(runtimeChains).length > 0,
    );

    // Initialize todo-continuation hook (opt-in auto-continue for
    // incomplete todos)
    todoContinuationHook = createTodoContinuationHook(ctx, {
      maxContinuations: config.todoContinuation?.maxContinuations ?? 5,
      cooldownMs: config.todoContinuation?.cooldownMs ?? 3000,
      autoEnable: config.todoContinuation?.autoEnable ?? false,
      autoEnableThreshold: config.todoContinuation?.autoEnableThreshold ?? 4,
    });
    taskSessionManagerHook = createTaskSessionManagerHook(ctx, {
      maxSessionsPerAgent: config.sessionManager?.maxSessionsPerAgent ?? 2,
      readContextMinLines: config.sessionManager?.readContextMinLines ?? 10,
      readContextMaxFiles: config.sessionManager?.readContextMaxFiles ?? 8,
      shouldManageSession: (sessionID) =>
        sessionAgentMap.get(sessionID) === 'orchestrator',
    });
    interviewManager = createInterviewManager(ctx, config);
    presetManager = createPresetManager(ctx, config);

    subtaskState = createSubtaskState();
    subtaskCommandManager = createSubtaskCommandManager(ctx, subtaskState);

    toolCount =
      Object.keys(councilTools).length +
      Object.keys(todoContinuationHook.tool).length +
      1 + // webfetch
      2 + // ast_grep_search, ast_grep_replace
      2; // subtask, read_session
  } catch (err) {
    // Plugin init failed: log visibly before re-throwing so the user
    // sees something actionable instead of a silent "loaded but empty".
    log('[plugin] FATAL: init failed', String(err));
    await appLog(
      ctx,
      'error',
      `INIT FAILED: ${String(err)}. Report at github.com/mizu-pras/not-my-opencode/issues/310`,
    );
    throw err;
  }

  // ── Health check: validate registrations ────────────────────────────
  const agentCount = Object.keys(agents).length;
  const mcpCount = Object.keys(mcps).length;
  // Skip MCP threshold when user explicitly disabled all built-in MCPs
  const mcpThreshold =
    config.disabled_mcps && config.disabled_mcps.length > 0
      ? 0
      : HEALTH_CHECK.minMcps;

  if (
    agentCount < HEALTH_CHECK.minAgents ||
    toolCount < HEALTH_CHECK.minTools ||
    mcpCount < mcpThreshold
  ) {
    const msg = [
      'Health check: registrations suspiciously low.',
      `  agents: ${agentCount} (expected >=${HEALTH_CHECK.minAgents})`,
      `  tools:  ${toolCount} (expected >=${HEALTH_CHECK.minTools})`,
      `  mcps:   ${mcpCount} (expected >=${mcpThreshold})`,
      'This usually means a dependency failed to resolve (jsdom, etc).',
      'If you recently updated opencode, see:',
      '  github.com/mizu-pras/not-my-opencode/issues/310',
    ].join('\n');
    log(`[plugin] WARN: ${msg}`);
    await appLog(ctx, 'warn', msg);
  } else {
    log('[plugin] health check passed', {
      agents: agentCount,
      tools: toolCount,
      mcps: mcpCount,
    });
  }

  // ── Probe jsdom (async, non-blocking) ───────────────────────────────
  // Don't await this; we don't want to block init. The warning will
  // appear shortly after startup if jsdom is broken.
  probeJSDOM().then((err) => {
    if (err) {
      const msg = `jsdom probe failed; webfetch tool will not work: ${err}`;
      log(`[plugin] WARN: ${msg}`);
      appLog(ctx, 'warn', msg).catch(() => {});
    }
  });

  return {
    name: 'not-my-opencode',

    agent: agents,

    tool: {
      ...councilTools,
      webfetch,
      ...todoContinuationHook.tool,
      ast_grep_search,
      ast_grep_replace,
      subtask: createSubtaskTool(ctx, subtaskState, depthTracker),
      read_session: createReadSessionTool(ctx.client, subtaskState),
    },

    mcp: mcps,

    config: async (opencodeConfig: Record<string, unknown>) => {
      configureOpenCodeConfig({
        opencodeConfig,
        config,
        agents,
        agentDefs,
        mcps,
        runtimeChains,
        recordTuiModels: recordTuiAgentModels,
        registerCommands: [
          (nextConfig) => interviewManager.registerCommand(nextConfig),
          (nextConfig) => presetManager.registerCommand(nextConfig),
          (nextConfig) => subtaskCommandManager.registerCommand(nextConfig),
        ],
        log,
      });
    },

    event: async (input) => {
      const event = input.event as {
        type: string;
        properties?: {
          info?: {
            id?: string;
            parentID?: string;
            title?: string;
            agent?: string;
            providerID?: string;
            modelID?: string;
            sessionID?: string;
          };
          sessionID?: string;
          id?: string;
          requestID?: string;
          status?: { type: string };
        };
      };

      if (event.type === 'message.updated') {
        const info = event.properties?.info;
        if (
          typeof info?.agent === 'string' &&
          typeof info.providerID === 'string' &&
          typeof info.modelID === 'string'
        ) {
          recordTuiAgentModel({
            agentName: resolveRuntimeAgentName(config, info.agent),
            model: `${info.providerID}/${info.modelID}`,
          });
        }
      }

      if (event.type === 'session.created') {
        const childSessionId = event.properties?.info?.id;
        const parentSessionId = event.properties?.info?.parentID;
        if (depthTracker && childSessionId && parentSessionId) {
          depthTracker.registerChild(parentSessionId, childSessionId);
        }
      }

      // Runtime model fallback for foreground agents (rate-limit detection)
      await foregroundFallback.handleEvent(input.event);

      // Todo-continuation: auto-continue orchestrator on incomplete todos
      await todoContinuationHook.handleEvent(input);

      // Handle auto-update checking
      await autoUpdateChecker.event(input);

      // Handle multiplexer pane spawning for OpenCode's Task tool sessions
      await multiplexerSessionManager.onSessionCreated(event);

      // Handle session.status events for pane cleanup
      await multiplexerSessionManager.onSessionStatus(event);

      // Handle session.deleted events for pane cleanup
      await multiplexerSessionManager.onSessionDeleted(event);

      await interviewManager.handleEvent(
        input as {
          event: { type: string; properties?: Record<string, unknown> };
        },
      );

      await taskSessionManagerHook.event(
        input as {
          event: {
            type: string;
            properties?: { info?: { id?: string }; sessionID?: string };
          };
        },
      );

      subtaskCommandManager.handleEvent(
        input as {
          event: {
            type: string;
            properties?: {
              info?: { id?: string; parentID?: string };
              sessionID?: string;
            };
          };
        },
      );

      if (input.event.type === 'session.deleted') {
        const props = input.event.properties as
          | { info?: { id?: string }; sessionID?: string }
          | undefined;
        const sessionID = props?.info?.id ?? props?.sessionID;

        if (depthTracker && sessionID) {
          depthTracker.cleanup(sessionID);
        }
        if (sessionID) {
          sessionAgentMap.delete(sessionID);
        }
      }
    },

    // Best-effort rescue only for stale apply_patch input before native
    // execution
    'tool.execute.before': async (input, output) => {
      await applyPatchHook['tool.execute.before'](
        input as {
          tool: string;
          directory?: string;
        },
        output as {
          args?: { patchText?: unknown; [key: string]: unknown };
        },
      );

      await taskSessionManagerHook['tool.execute.before'](
        input as {
          tool: string;
          sessionID?: string;
          callID?: string;
        },
        output as { args?: unknown },
      );
    },

    // Direct interception of /auto-continue command — bypasses LLM
    // round-trip
    'command.execute.before': async (input, output) => {
      await todoContinuationHook.handleCommandExecuteBefore(
        input as {
          command: string;
          sessionID: string;
          arguments: string;
        },
        output as { parts: Array<{ type: string; text?: string }> },
      );

      await interviewManager.handleCommandExecuteBefore(
        input as {
          command: string;
          sessionID: string;
          arguments: string;
        },
        output as { parts: Array<{ type: string; text?: string }> },
      );

      await presetManager.handleCommandExecuteBefore(
        input as {
          command: string;
          sessionID: string;
          arguments: string;
        },
        output as { parts: Array<{ type: string; text?: string }> },
      );
    },

    'chat.headers': chatHeadersHook['chat.headers'],

    // Track which agent each session uses (needed for serve-mode prompt
    // injection)
    'chat.message': async (
      input: { sessionID: string; agent?: string },
      output?: { message?: { agent?: string } },
    ) => {
      const rawAgent = input.agent ?? output?.message?.agent;
      const agent = rawAgent
        ? resolveRuntimeAgentName(config, rawAgent)
        : undefined;

      if (
        agent &&
        output?.message &&
        typeof output.message.agent === 'string'
      ) {
        output.message.agent = agent;
      }

      if (agent) {
        sessionAgentMap.set(input.sessionID, agent);
      }
      todoContinuationHook.handleChatMessage({
        sessionID: input.sessionID,
        agent,
      });
    },

    // Inject orchestrator system prompt for serve-mode sessions. In serve
    // mode, the agent's prompt field may be absent from the agents
    // registry (built before plugin config hooks run). This hook injects
    // it at LLM call time. Uses the already-resolved prompt from
    // agentDefs (which has custom replacement or append prompts applied)
    // instead of rebuilding the default.
    'experimental.chat.system.transform': async (
      input: { sessionID?: string },
      output: { system: string[] },
    ): Promise<void> => {
      const agentName = input.sessionID
        ? sessionAgentMap.get(input.sessionID)
        : undefined;
      if (agentName === 'orchestrator') {
        const alreadyInjected = output.system.some(
          (s) =>
            typeof s === 'string' &&
            s.includes('<Role>') &&
            s.includes('orchestrator'),
        );
        if (!alreadyInjected) {
          // Prepend the orchestrator prompt to the system array. Use the
          // resolved prompt from the orchestrator agent definition (which
          // includes any custom replacement or append from orchestrator.md
          // / orchestrator_append.md) Fall back to
          // buildOrchestratorPrompt only if the resolved prompt is
          // missing.
          const orchestratorDef = agentDefs.find(
            (a) => a.name === 'orchestrator',
          );
          const orchestratorPrompt =
            typeof orchestratorDef?.config?.prompt === 'string'
              ? orchestratorDef.config.prompt
              : buildOrchestratorPrompt(disabledAgents);
          output.system[0] =
            orchestratorPrompt +
            (output.system[0] ? `\n\n${output.system[0]}` : '');
        }
      }

      // Collapse to single system message for provider compatibility.
      // Some providers (e.g. Qwen via VLLM/DashScope) reject multiple
      // system messages. Sub-hooks above may push additional entries; join
      // them back into one element so OpenCode emits a single system
      // message.
      collapseSystemInPlace(output.system);
    },

    // Inject phase reminder and filter available skills before sending to
    // API (doesn't show in UI)
    'experimental.chat.messages.transform': async (
      input: Record<string, never>,
      output: { messages: unknown[] },
    ): Promise<void> => {
      // Type assertion since we know the structure matches
      // MessageWithParts[]
      const typedOutput = output as {
        messages: Array<{
          info: { role: string; agent?: string; sessionID?: string };
          parts: Array<{
            type: string;
            text?: string;
            [key: string]: unknown;
          }>;
        }>;
      };

      for (const message of typedOutput.messages) {
        if (message.info.role !== 'user') {
          continue;
        }
        for (const part of message.parts) {
          if (part.type !== 'text' || typeof part.text !== 'string') {
            continue;
          }
          part.text = rewriteDisplayNameMentions(part.text);
        }
      }

      // Strip image parts from orchestrator messages when @observer is
      // available. When the orchestrator's model doesn't support image
      // input, the API call fails before the LLM can respond. We replace
      // image bytes with a text nudge so the orchestrator delegates to
      // @observer instead.
      processImageAttachments({
        messages: typedOutput.messages,
        workDir: ctx.directory,
        disabledAgents,
        log,
      });

      await todoContinuationHook.handleMessagesTransform({
        messages: typedOutput.messages,
      });
      await taskSessionManagerHook['experimental.chat.messages.transform'](
        input,
        typedOutput,
      );
      await phaseReminderHook['experimental.chat.messages.transform'](
        input,
        typedOutput,
      );
      await filterAvailableSkillsHook['experimental.chat.messages.transform'](
        input,
        typedOutput,
      );
    },

    // Post-tool hooks: retry guidance for delegation errors + file-tool
    // nudge
    'tool.execute.after': async (input, output) => {
      const meta = input as {
        tool?: string;
        sessionID?: string;
        callID?: string;
      };
      const runPostToolHook = async (
        name: string,
        fn: () => Promise<void>,
      ): Promise<void> => {
        try {
          await fn();
        } catch (error) {
          log('[plugin] post-tool hook failed open', {
            hook: name,
            tool: meta.tool,
            sessionID: meta.sessionID,
            callID: meta.callID,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      await runPostToolHook('delegate-task-retry', () =>
        delegateTaskRetryHook['tool.execute.after'](
          input as { tool: string },
          output as { output: unknown },
        ),
      );

      await runPostToolHook('json-error-recovery', () =>
        jsonErrorRecoveryHook['tool.execute.after'](
          input as {
            tool: string;
            sessionID: string;
            callID: string;
          },
          output as {
            title: string;
            output: unknown;
            metadata: unknown;
          },
        ),
      );

      await runPostToolHook('todo-continuation', () =>
        todoContinuationHook.handleToolExecuteAfter(
          input as {
            tool: string;
            sessionID?: string;
          },
          output as { output?: unknown },
        ),
      );

      await runPostToolHook('post-file-tool-nudge', () =>
        postFileToolNudgeHook['tool.execute.after'](
          input as {
            tool: string;
            sessionID?: string;
            callID?: string;
          },
          output as {
            title: string;
            output: string;
            metadata: Record<string, unknown>;
          },
        ),
      );

      await runPostToolHook('task-session-manager', () =>
        taskSessionManagerHook['tool.execute.after'](
          input as {
            tool: string;
            sessionID?: string;
            callID?: string;
          },
          output as { output: unknown },
        ),
      );
    },
  };
};

export default OhMyOpenCodeLite;

export type {
  AgentName,
  AgentOverrideConfig,
  McpName,
  MultiplexerConfig,
  MultiplexerLayout,
  MultiplexerType,
  PluginConfig,
  TmuxConfig,
  TmuxLayout,
} from './config';
export type { RemoteMcpConfig } from './mcp';
