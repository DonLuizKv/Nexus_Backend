import { randomBytes } from "crypto";
import { NextFunction, Request, Response } from "express";

export const generateCode = (length: number = 6): string => {
    const CHARS: string = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const bytes: Buffer = randomBytes(length);
    let random: string = "";

    for (let i = 0; i < length; i++) {
        random += CHARS[bytes.readInt8(i) % CHARS.length];
    }

    return random;
}

export const Time = {
    second: (n: number) => n * 1000,
    minute: (n: number) => n * 60 * 1000,
    hour: (n: number) => n * 60 * 60 * 1000,
    day: (n: number) => n * 24 * 60 * 60 * 1000,
    week: (n: number) => n * 7 * 24 * 60 * 60 * 1000,
};

type fnType = (req: Request, res: Response, next: NextFunction) => Promise<any>;
type asyncHandlerType = (fn: fnType) => fnType;

export const asyncHandler: asyncHandlerType = (fn: fnType) => {
    return (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);
}