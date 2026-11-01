import { inspect } from "node:util";
import { Request, Response, NextFunction } from "express";
import { BG_COLORS, COLORS, EFFECTS, HTTP_METHOD_COLORS, RESET } from "./ansiCodes";
import { Color, LogLevel, StyleConfig, LogConfig, ExtraConfigLog, HttpMethods, LoggerOptions } from "./loggerTypes";

type Out = (line?: unknown) => void;

const LEVELS: LogLevel[] = [
    "info", "warn", "error", "debug",
    "http", "socket",
    "db", "sql", "redis", "mongo", "queue", "cache", "cron",
    "system",
];

const RANK: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    http: 2, socket: 2, db: 2, sql: 2, redis: 2, mongo: 2, queue: 2, cache: 2, cron: 2, system: 2,
    warn: 3,
    error: 4,
};

const DEFAULT_STYLES: Record<LogLevel, LogConfig> = {
    info: { general: { color: "green" }, tag: { color: "green", bold: true } },
    warn: { general: { color: "yellow" }, tag: { color: "yellow", bold: true } },
    error: { general: { color: "red" }, tag: { color: "red", bold: true } },
    debug: { general: { color: "gray" }, tag: { color: "gray", bold: true } },
    http: { general: { color: "white" }, tag: { color: "white", bold: true } },
    socket: { general: { color: "violet" }, tag: { color: "violet", bold: true } },
    db: { general: { color: "blue" }, tag: { color: "blue", bold: true } },
    sql: { general: { color: "cyan" }, tag: { color: "cyan", bold: true } },
    redis: { general: { color: "red" }, tag: { color: "red", bold: true } },
    mongo: { general: { color: "green" }, tag: { color: "green", bold: true } },
    queue: { general: { color: "orange" }, tag: { color: "orange", bold: true } },
    cache: { general: { color: "yellow" }, tag: { color: "yellow", bold: true } },
    cron: { general: { color: "purple" }, tag: { color: "purple", bold: true } },
    system: { general: { color: "cyan" }, tag: { color: "cyan", bold: true } },
};

function buildCodes(style?: StyleConfig): string {
    if (!style) return "";
    let out = "";
    if (style.color) out += COLORS[style.color];
    if (style.bgColor) out += BG_COLORS[style.bgColor];
    if (style.bold) out += EFFECTS.bold;
    if (style.dim) out += EFFECTS.dim;
    if (style.italic) out += EFFECTS.italic;
    if (style.underline) out += EFFECTS.underline;
    return out;
}

function merge(...styles: (StyleConfig | undefined)[]): StyleConfig {
    return Object.assign({}, ...styles);
}

const TAG_FAST: Record<LogLevel, string> = Object.fromEntries(
    LEVELS.map((level): [LogLevel, string] => {
        const base = DEFAULT_STYLES[level];
        return [level, `[${buildCodes(merge(base.general, base.tag))}${level.toUpperCase()}${RESET}] `];
    })
) as Record<LogLevel, string>;

const MSG_FAST: Record<LogLevel, string> = Object.fromEntries(
    LEVELS.map((level): [LogLevel, string] => [level, buildCodes(DEFAULT_STYLES[level].general)])
) as Record<LogLevel, string>;

function pad(value: number, length = 2): string {
    return String(value).padStart(length, "0");
}

export class Logger {
    private static threshold = Logger.parseLevel(process.env.LOG_LEVEL);
    private static timeEnabled = process.env.LOG_TIME !== "false";
    private static pretty = process.env.LOG_PRETTY === "true";

    private static parseLevel(value?: string): number {
        if (!value) return 0;
        return RANK[value.trim().toLowerCase() as LogLevel] ?? 0;
    }

    public static configure(options: LoggerOptions): void {
        if (options.level !== undefined) Logger.threshold = RANK[options.level] ?? 0;
        if (options.time !== undefined) Logger.timeEnabled = options.time;
        if (options.pretty !== undefined) Logger.pretty = options.pretty;
    }

    private static formatTime(now: number): string {
        const d = new Date(now);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
    }

    private static inspectData(data: unknown): string {
        return inspect(data, { colors: false, depth: Logger.pretty ? null : 2 });
    }

    private static applyStyle(text: string, style?: StyleConfig, general?: StyleConfig): string {
        const codes = buildCodes(merge(general, style));
        return codes ? codes + text + RESET : text;
    }

    private static write(level: LogLevel, message: string | Error, extra: ExtraConfigLog = {}): void {
        if (RANK[level] < Logger.threshold) return;

        const { styles, prefix, suffix, ctx, data } = extra;
        const time = extra.time ?? Logger.timeEnabled;
        const base = DEFAULT_STYLES[level];
        const general = merge(base.general, styles?.general);

        const parts: string[] = [];
        if (time) parts.push(`[${buildCodes(general)}${Logger.formatTime(Date.now())}${RESET}] `);
        if (ctx) parts.push(`[${buildCodes(merge(base.general, styles?.ctx, { color: "gray" }))}${ctx}${RESET}] `);
        if (prefix) parts.push(`${prefix} `);

        const tag = styles
            ? `[${buildCodes(merge(general, styles.tag ?? base.tag))}${level.toUpperCase()}${RESET}] `
            : TAG_FAST[level];
        parts.push(tag);

        const text = message instanceof Error ? message.message : message;
        const body = styles
            ? `${buildCodes(merge(general, styles.msg))}${text}${RESET}`
            : `${MSG_FAST[level]}${text}${RESET}`;

        const line = parts.join("") + body + (data !== undefined ? `\n${Logger.inspectData(data)}` : "") + (suffix ?? "");

        const out: Out = level === "error" ? console.error.bind(console) : level === "warn" ? console.warn.bind(console) : console.log.bind(console);
        out(line);

        if (message instanceof Error && message.stack) {
            out(`${MSG_FAST[level]}${message.stack}${RESET}`);
        }
    }

    public static info(msg: string, extra: ExtraConfigLog = {}): void { this.write("info", msg, extra); }
    public static warn(msg: string, extra: ExtraConfigLog = {}): void { this.write("warn", msg, extra); }
    public static error(msg: string | Error, extra: ExtraConfigLog = {}): void { this.write("error", msg, extra); }
    public static debug(msg: string, extra: ExtraConfigLog = {}): void { this.write("debug", msg, extra); }

    public static http(msg: string, extra: ExtraConfigLog = {}): void { this.write("http", msg, extra); }
    public static socket(msg: string, extra: ExtraConfigLog = {}): void { this.write("socket", msg, extra); }

    public static db(msg: string, extra: ExtraConfigLog = {}): void { this.write("db", msg, extra); }
    public static sql(msg: string, extra: ExtraConfigLog = {}): void { this.write("sql", msg, extra); }
    public static redis(msg: string, extra: ExtraConfigLog = {}): void { this.write("redis", msg, extra); }
    public static mongo(msg: string, extra: ExtraConfigLog = {}): void { this.write("mongo", msg, extra); }
    public static queue(msg: string, extra: ExtraConfigLog = {}): void { this.write("queue", msg, extra); }
    public static cache(msg: string, extra: ExtraConfigLog = {}): void { this.write("cache", msg, extra); }
    public static cron(msg: string, extra: ExtraConfigLog = {}): void { this.write("cron", msg, extra); }
    public static system(msg: string, extra: ExtraConfigLog = {}): void { this.write("system", msg, extra); }

    public static httpMiddleware(options: { skip?: (req: Request, res: Response) => boolean } = {}) {
        return (req: Request, res: Response, next: NextFunction) => {
            if (options.skip?.(req, res)) return next();
            const start = process.hrtime.bigint();

            res.on("finish", () => {
                const ms = Number(process.hrtime.bigint() - start) / 1e6;
                const method = req.method.toUpperCase() as HttpMethods;
                const methodColored = this.applyStyle(method, { color: HTTP_METHOD_COLORS[method] ?? "white", bold: true });

                const statusColor: Color = res.statusCode >= 500 ? "red" : res.statusCode >= 400 ? "yellow" : res.statusCode >= 300 ? "cyan" : "green";
                const statusColored = this.applyStyle(String(res.statusCode), { color: statusColor, bold: true });

                const details = [
                    req.ip ?? req.socket.remoteAddress ?? "-",
                    `${ms.toFixed(2)}ms`,
                ];
                const ua = req.headers["user-agent"];
                if (ua) details.push(String(ua).slice(0, 60));

                this.http(`${methodColored} ${req.originalUrl} ${statusColored} ${details.join(" · ")}`);
            });

            next();
        };
    }
}
