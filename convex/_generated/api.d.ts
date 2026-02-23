/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agents from "../agents.js";
import type * as agentsUtils from "../agentsUtils.js";
import type * as ai from "../ai.js";
import type * as ai_config from "../ai_config.js";
import type * as auth from "../auth.js";
import type * as campaigns from "../campaigns.js";
import type * as chat from "../chat.js";
import type * as contacts from "../contacts.js";
import type * as contextBuilder from "../contextBuilder.js";
import type * as errorUtils from "../errorUtils.js";
import type * as files from "../files.js";
import type * as filesInternal from "../filesInternal.js";
import type * as http from "../http.js";
import type * as index from "../index.js";
import type * as integrations from "../integrations.js";
import type * as manualCatalog from "../manualCatalog.js";
import type * as messages from "../messages.js";
import type * as metaNumbersSync from "../metaNumbersSync.js";
import type * as migrations from "../migrations.js";
import type * as mobileRuntimeEvents from "../mobileRuntimeEvents.js";
import type * as nodeUtils from "../nodeUtils.js";
import type * as notificationPreferences from "../notificationPreferences.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as products from "../products.js";
import type * as pushPolicy from "../pushPolicy.js";
import type * as salla from "../salla.js";
import type * as sallaWebhookUtils from "../sallaWebhookUtils.js";
import type * as seed from "../seed.js";
import type * as stats from "../stats.js";
import type * as system from "../system.js";
import type * as templateStore from "../templateStore.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";
import type * as webhookEvents from "../webhookEvents.js";
import type * as webhookSettings from "../webhookSettings.js";
import type * as webhookUtils from "../webhookUtils.js";
import type * as whatsapp from "../whatsapp.js";
import type * as whatsappNumbers from "../whatsappNumbers.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agents: typeof agents;
  agentsUtils: typeof agentsUtils;
  ai: typeof ai;
  ai_config: typeof ai_config;
  auth: typeof auth;
  campaigns: typeof campaigns;
  chat: typeof chat;
  contacts: typeof contacts;
  contextBuilder: typeof contextBuilder;
  errorUtils: typeof errorUtils;
  files: typeof files;
  filesInternal: typeof filesInternal;
  http: typeof http;
  index: typeof index;
  integrations: typeof integrations;
  manualCatalog: typeof manualCatalog;
  messages: typeof messages;
  metaNumbersSync: typeof metaNumbersSync;
  migrations: typeof migrations;
  mobileRuntimeEvents: typeof mobileRuntimeEvents;
  nodeUtils: typeof nodeUtils;
  notificationPreferences: typeof notificationPreferences;
  notifications: typeof notifications;
  orders: typeof orders;
  products: typeof products;
  pushPolicy: typeof pushPolicy;
  salla: typeof salla;
  sallaWebhookUtils: typeof sallaWebhookUtils;
  seed: typeof seed;
  stats: typeof stats;
  system: typeof system;
  templateStore: typeof templateStore;
  templates: typeof templates;
  users: typeof users;
  webhookEvents: typeof webhookEvents;
  webhookSettings: typeof webhookSettings;
  webhookUtils: typeof webhookUtils;
  whatsapp: typeof whatsapp;
  whatsappNumbers: typeof whatsappNumbers;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  actionRetrier: {
    public: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        boolean
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        any
      >;
      start: FunctionReference<
        "mutation",
        "internal",
        {
          functionArgs: any;
          functionHandle: string;
          options: {
            base: number;
            initialBackoffMs: number;
            logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
            maxFailures: number;
            onComplete?: string;
            runAfter?: number;
            runAt?: number;
          };
        },
        string
      >;
      status: FunctionReference<
        "query",
        "internal",
        { runId: string },
        | { type: "inProgress" }
        | {
            result:
              | { returnValue: any; type: "success" }
              | { error: string; type: "failed" }
              | { type: "canceled" };
            type: "completed";
          }
      >;
    };
  };
  crons: {
    public: {
      del: FunctionReference<
        "mutation",
        "internal",
        { identifier: { id: string } | { name: string } },
        null
      >;
      get: FunctionReference<
        "query",
        "internal",
        { identifier: { id: string } | { name: string } },
        {
          args: Record<string, any>;
          functionHandle: string;
          id: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        } | null
      >;
      list: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          args: Record<string, any>;
          functionHandle: string;
          id: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        }>
      >;
      register: FunctionReference<
        "mutation",
        "internal",
        {
          args: Record<string, any>;
          functionHandle: string;
          name?: string;
          schedule:
            | { kind: "interval"; ms: number }
            | { cronspec: string; kind: "cron"; tz?: string };
        },
        string
      >;
    };
  };
  pushNotifications: {
    public: {
      deleteNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      getNotification: FunctionReference<
        "query",
        "internal",
        { id: string; logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        null | {
          _contentAvailable?: boolean;
          _creationTime: number;
          badge?: number;
          body?: string;
          categoryId?: string;
          channelId?: string;
          data?: any;
          expiration?: number;
          interruptionLevel?:
            | "active"
            | "critical"
            | "passive"
            | "time-sensitive";
          mutableContent?: boolean;
          numPreviousFailures: number;
          priority?: "default" | "normal" | "high";
          sound?: string | null;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title?: string;
          ttl?: number;
        }
      >;
      getNotificationsForUser: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          userId: string;
        },
        Array<{
          _contentAvailable?: boolean;
          _creationTime: number;
          badge?: number;
          body?: string;
          categoryId?: string;
          channelId?: string;
          data?: any;
          expiration?: number;
          id: string;
          interruptionLevel?:
            | "active"
            | "critical"
            | "passive"
            | "time-sensitive";
          mutableContent?: boolean;
          numPreviousFailures: number;
          priority?: "default" | "normal" | "high";
          sound?: string | null;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title?: string;
          ttl?: number;
        }>
      >;
      getStatusForUser: FunctionReference<
        "query",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        { hasToken: boolean; paused: boolean }
      >;
      pauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      recordPushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        {
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          pushToken: string;
          userId: string;
        },
        null
      >;
      removePushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      restart: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        boolean
      >;
      sendPushNotification: FunctionReference<
        "mutation",
        "internal",
        {
          allowUnregisteredTokens?: boolean;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          notification: {
            _contentAvailable?: boolean;
            badge?: number;
            body?: string;
            categoryId?: string;
            channelId?: string;
            data?: any;
            expiration?: number;
            interruptionLevel?:
              | "active"
              | "critical"
              | "passive"
              | "time-sensitive";
            mutableContent?: boolean;
            priority?: "default" | "normal" | "high";
            sound?: string | null;
            subtitle?: string;
            title?: string;
            ttl?: number;
          };
          userId: string;
        },
        string | null
      >;
      sendPushNotificationBatch: FunctionReference<
        "mutation",
        "internal",
        {
          allowUnregisteredTokens?: boolean;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          notifications: Array<{
            notification: {
              _contentAvailable?: boolean;
              badge?: number;
              body?: string;
              categoryId?: string;
              channelId?: string;
              data?: any;
              expiration?: number;
              interruptionLevel?:
                | "active"
                | "critical"
                | "passive"
                | "time-sensitive";
              mutableContent?: boolean;
              priority?: "default" | "normal" | "high";
              sound?: string | null;
              subtitle?: string;
              title?: string;
              ttl?: number;
            };
            userId: string;
          }>;
        },
        Array<string | null>
      >;
      shutdown: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        { data?: any; message: string }
      >;
      unpauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
    };
  };
};
