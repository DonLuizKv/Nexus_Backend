import { ErrorManager } from "./ErrorManager";

export const Errors = {
    DB: {
        CONNECTION_ERROR: (msg: string = "Database connection error") => new ErrorManager(msg, 500, false),
        QUERY_ERROR: (msg: string = "Database query error") => new ErrorManager(msg, 500, false),
    },
    JWT: {
        INVALID_TOKEN: (msg: string = "Invalid token") => new ErrorManager(msg, 401, false),
    },
    SERVER: {
        PORT_NOT_FOUND: (msg: string = "Port not found") => new ErrorManager(msg, 500, false),
        ORIGINS_NOT_FOUND: (msg: string = "Origins not found") => new ErrorManager(msg, 500, false),
        CORS_ERROR: (msg: string = "Not allowed by CORS") => new ErrorManager(msg, 403, false),
        INTERNAL_SERVER_ERROR: (msg: string = "Internal Server Error") => new ErrorManager(msg, 500, false),
    },
    CLIENT: {
        NOT_FOUND: (msg: string = "Not Found") => new ErrorManager(msg, 404),
        UNAUTHORIZED: (msg: string = "Unauthorized") => new ErrorManager(msg, 401),
        FORBIDDEN: (msg: string = "Forbidden") => new ErrorManager(msg, 403),
        BAD_REQUEST: (msg: string = "Bad Request") => new ErrorManager(msg, 400),
        CONFLICT: (msg: string = "Conflict") => new ErrorManager(msg, 409),
    }
} as const;