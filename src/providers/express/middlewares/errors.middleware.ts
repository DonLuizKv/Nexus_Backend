import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ErrorManager } from "../../../shared/errors/ErrorManager";
import { Logger } from "../../logs/Logger";

export const errorsMiddleware: ErrorRequestHandler = (err: ErrorManager, req: Request, res: Response, next: NextFunction) => {
    let error = err;

    // 🔧 Si no es tu error, conviértelo
    if (!(err instanceof ErrorManager)) {
        error = new ErrorManager("Internal server error", 500, false);
    }

    const { statusCode, message, isOperational } = error;

    // 🧠 Logueo inteligente
    if (!isOperational) {
        Logger.error(`UNEXPECTED ERROR: ${err}`);
    }

    Logger.error(err);

    res.status(statusCode).json({ message });
};