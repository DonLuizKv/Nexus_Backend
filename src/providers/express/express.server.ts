import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import Express, { Request, Response } from "express";
import { Errors } from "../../shared/errors/Errors";
import { Logger } from "../logs/Logger";
import { errorsMiddleware } from "./middleware/errors.middleware";
import { corsMiddleware } from "./middleware/cors.middleware";
import type { PrismaClient } from "../prisma/client";
import type { EnvironmentKeys } from "../../config/env";
import { ScraperModule } from "../../modules/scraper/scraper.module";
import { SeriesModule } from "../../modules/series/series.module";
import { FranchisesModule } from "../../modules/franchises/franchises.module";
import { EpisodesModule } from "../../modules/episodes/episodes.module";
import { ScrapingClient } from "../scraping/client";


type ExpressServerDependencies = {
    origins: string[];
    db: PrismaClient;
    scraperModule: ScrapingClient;
    jwt: EnvironmentKeys["JWT"];
}

interface IExpressServer {
    setup(): Promise<void>;
    getApp(): Express.Application;
}

export class ExpressServer implements IExpressServer {
    private app: Express.Application;

    constructor(private config: ExpressServerDependencies) {
        this.app = Express();
    }

    private setupMiddlewares(): void {
        const corsOptions = {
            origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                if (!origin || this.config.origins.includes(origin)) {
                    return callback(null, true);
                }

                const message = `Origin ${origin} is not allowed by CORS`;
                Logger.warn(message);

                return callback(Errors.CLIENT.FORBIDDEN(message), false);
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
        };

        this.app.use(Logger.httpMiddleware());
        this.app.use(Express.json());
        this.app.use(Express.urlencoded({ extended: true }));
        this.app.use(cookieParser());
        this.app.use(cors(corsOptions));
    }

    private setUpErrorMiddlewares(): void {
        this.app.use(corsMiddleware);
        this.app.use(errorsMiddleware);
    }

    private setupRoutes(): void {
        this.app.use("/api/v1/series", SeriesModule.create({ db: this.config.db }));
        this.app.use("/api/v1/franchises", FranchisesModule.create({ db: this.config.db }));
        this.app.use("/api/v1/episodes", EpisodesModule.create({ db: this.config.db }));

        this.app.use("/api/v1/scraper", ScraperModule.create({
            scraper: this.config.scraperModule
        }));

        // health check
        this.app.get("/api/v1/health", (_req: Request, res: Response) => {
            res.json({ message: "OK" });
        });

        // default
        this.app.get("/api/v1/", (_req: Request, res: Response) => {
            res.sendFile(path.join(__dirname, "../../../public/index.html"));
        });
    }

    public getApp(): Express.Application {
        return this.app;
    }

    public async setup(): Promise<void> {
        this.setupMiddlewares();
        this.setupRoutes();
        this.setUpErrorMiddlewares();
    }

}