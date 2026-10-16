import { Errors } from "../shared/errors/Errors";
import { SignOptions } from "jsonwebtoken";

export type EnvironmentKeys = {
    Global: {
        PORT: number,
        NODE_ENV: string,
        ORIGINS: string[]
    },
    DB: {
        // HOST: string,
        // PORT: number,
        // USER: string,
        // PASSWORD: string,
        // NAME: string,
        URL: string
    },
    // REDIS: {
    //     HOST: string,
    //     PORT: number,
    //     PASSWORD: string | undefined,
    //     DB: number
    // },
    JWT: {
        ACCESS_SECRET: string,
        REFRESH_SECRET: string,
        ACCESS_EXPIRES_IN: SignOptions["expiresIn"],
        REFRESH_EXPIRES_IN: SignOptions["expiresIn"]
    }
}

export class ConfigEnv {
    // Propiedades públicas y de solo lectura para proteger los datos
    public readonly Global: EnvironmentKeys["Global"];
    public readonly DB: EnvironmentKeys["DB"];
    // public readonly REDIS: EnvironmentKeys["REDIS"];
    public readonly JWT: EnvironmentKeys["JWT"];

    constructor() {
        this.Global = {
            PORT: this.requiredNumber("PORT"),
            NODE_ENV: this.requiredString("NODE_ENV"),
            ORIGINS: this.parseList("ORIGINS", []),
        };

        this.DB = {
            // HOST: this.requiredString("DB_HOST"),
            // PORT: this.requiredNumber("DB_PORT"),
            // USER: this.requiredString("DB_USER"),
            // PASSWORD: this.requiredString("DB_PASSWORD"),
            // NAME: this.requiredString("DB_NAME"),
            URL: this.requiredString("DATABASE_URL"),
        };

        // this.REDIS = {
        //     HOST: this.requiredString("REDIS_HOST"),
        //     PORT: this.requiredNumber("REDIS_PORT"),
        //     PASSWORD: this.optionalString("REDIS_PASSWORD"),
        //     DB: this.requiredNumber("REDIS_DB"),
        // };

        this.JWT = {
            ACCESS_SECRET: this.requiredString("JWT_ACCESS_SECRET"),
            REFRESH_SECRET: this.requiredString("JWT_REFRESH_SECRET"),
            ACCESS_EXPIRES_IN: this.parseExpiresIn("JWT_ACCESS_EXPIRES_IN"),
            REFRESH_EXPIRES_IN: this.parseExpiresIn("JWT_REFRESH_EXPIRES_IN"),
        };
    }

    private requiredString(name: string): string {
        const value = process.env[name];
        if (!value) {
            throw Errors.SERVER.INTERNAL_SERVER_ERROR(`Missing environment variable: ${name}`);
        }
        return value;
    }

    private requiredNumber(name: string, defaultValue?: number): number {
        const value = process.env[name];
        if (!value) {
            if (defaultValue === undefined) {
                throw Errors.SERVER.INTERNAL_SERVER_ERROR(`Missing environment variable: ${name}`);
            }
            return defaultValue;
        }

        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
            throw Errors.SERVER.INTERNAL_SERVER_ERROR(`Environment variable ${name} must be a number`);
        }

        return parsed;
    }

    private parseList(name: string, defaultValue: string[] = []): string[] {
        const value = process.env[name];
        if (!value) return defaultValue;
        return value.split(",").map(v => v.trim());
    }

    private parseExpiresIn(name: string, defaultValue?: SignOptions["expiresIn"]): SignOptions["expiresIn"] {
        const value = process.env[name];

        if (!value) {
            if (defaultValue === undefined) {
                throw Errors.SERVER.INTERNAL_SERVER_ERROR(`Missing environment variable: ${name}`);
            }
            return defaultValue;
        }

        const asNumber = Number(value);
        if (!Number.isNaN(asNumber)) {
            return asNumber;
        }

        const regex = /^(\d+)(s|m|h|d)$/;
        if (!regex.test(value)) {
            throw Errors.SERVER.INTERNAL_SERVER_ERROR(
                `Environment variable ${name} must be a number or valid time string`
            );
        }

        return value as SignOptions["expiresIn"];
    }

    private optionalString(name: string): string | undefined {
        return process.env[name];
    }
}