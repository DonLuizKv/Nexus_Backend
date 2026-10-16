import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { Token } from "./TokenType";
import type { EnvironmentKeys } from "../../config/env";

// 🔹 Helper base para firmar tokens
const sign = (
    payload: Token,
    secret: string,
    expiresIn?: SignOptions["expiresIn"] // que expires in sea exactamente como lo dice el propio jwt
): string => {
    const options: SignOptions = expiresIn !== undefined ? { expiresIn } : {};
    return jwt.sign(payload, secret, options);
};

// 🔹 Type guard (validación runtime)
const isToken = (payload: any): payload is Token => {
    return (
        typeof payload === "object" && payload !== null && typeof payload.sub === "number" &&
        (payload.role === "admin" || payload.role === "student")
    );
};

// 🔹 Verificar token (seguro)
export const verifyToken = (token: string, secret: string): Token => {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string" || !isToken(decoded)) {
        throw new Error("Invalid token payload");
    }

    return decoded;
};

// 🔹 Decode (sin validar firma)
export const decodeToken = (token: string): Token | null => {
    const decoded = jwt.decode(token);

    if (!isToken(decoded)) return null;

    return decoded;
};

// 🔹 Tokens específicos
export const generateAccessToken = (payload: Token, secret: string, expiresIn: SignOptions["expiresIn"]): string => {
    return sign(payload, secret, expiresIn);
};

export const generateRefreshToken = (payload: Token, secret: string, expiresIn: SignOptions["expiresIn"]): string => {
    return sign(payload, secret, expiresIn);
};