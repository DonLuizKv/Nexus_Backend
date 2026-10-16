
export type Color =
    | "black" | "red" | "green" | "yellow" | "blue" | "violet" | "white" | "cyan"
    | "gray" | "magenta" | "orange" | "pink" | "purple";

export type LogLevel =
    | "info" | "warn" | "error" | "debug"
    | "http" | "socket"
    | "db" | "sql" | "redis" | "mongo" | "queue" | "cache" | "cron"
    | "system";

export type HttpMethods = "POST" | "PUT" | "DELETE" | "GET" | "PATCH" | "OPTIONS" | "HEAD";

export interface StyleConfig {
    color?: Color;
    bgColor?: Color;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
}

export type LogPart = "general" | "tag" | "msg" | "time" | "ctx";
export type LogConfig = Partial<Record<LogPart, StyleConfig>>;

export interface ExtraConfigLog {
    styles?: LogConfig;
    prefix?: string;
    suffix?: string;
    ctx?: string;
    time?: boolean;
    data?: unknown;
}

export interface LoggerOptions {
    level?: LogLevel;
    time?: boolean;
    pretty?: boolean;
}
