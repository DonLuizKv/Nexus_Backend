import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { Logger } from "../../logs/Logger";
import { ErrorManager } from "../../../shared/errors/ErrorManager";
import { Errors } from "../../../shared/errors/Errors";

export const corsMiddleware: ErrorRequestHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ErrorManager) {
        return next(err);
    }

    if (err.message.includes("CORS")) {
        Logger.warn(`CORS blocked request from origin: ${req.headers.origin || 'unknown'}`);
        return next(Errors.CLIENT.FORBIDDEN(`CORS blocked request from origin: ${req.headers.origin || 'unknown'}`));
    }

    next(err);
};