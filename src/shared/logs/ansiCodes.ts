import { Color, HttpMethods } from "./loggerTypes";

export const COLORS: Record<Color, string> = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    violet: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
    magenta: "\x1b[35m",
    orange: "\x1b[38;5;208m",
    pink: "\x1b[38;5;211m",
    purple: "\x1b[38;5;141m",
};

export const BG_COLORS: Record<Color, string> = {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    violet: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    gray: "\x1b[100m",
    magenta: "\x1b[45m",
    orange: "\x1b[48;5;208m",
    pink: "\x1b[48;5;211m",
    purple: "\x1b[48;5;141m",
};

export const EFFECTS = {
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
    underline: "\x1b[4m",
} as const;

export const HTTP_METHOD_COLORS: Record<HttpMethods, Color> = {
    GET: "green",
    POST: "blue",
    PUT: "violet",
    DELETE: "red",
    PATCH: "yellow",
    OPTIONS: "cyan",
    HEAD: "white"
};

export const RESET = "\x1b[0m";
