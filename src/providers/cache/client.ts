import Redis from 'ioredis';
import { Logger } from '../logs/Logger';

type RedisConfig = {
    host: string;
    port: number;
    password?: string;
    db?: number;
};

export class RedisProvider {
    private client!: Redis;
    private config: RedisConfig;

    constructor(config: RedisConfig) {
        this.config = config;
    }

    public async setCache(key: string, value: unknown, ttl = 3600) {
        await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    }

    public async getCache(key: string) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    public async deleteCache(key: string) {
        await this.client.del(key);
    }

    public getRawConnection() {
        if (!this.client) throw new Error('Redis no está conectado. Asegúrate de llamar a initialize() primero.');
        return this.client;
    }
    
    public initialize() {
        try {
            this.client = new Redis({
                ...this.config,
                maxRetriesPerRequest: null
            });

            Logger.info("RedisProvider initialized successfully");
        } catch (error) {
            this.client.on('error', (error: Error) => {
                Logger.error(`Error in RedisProvider: ${error.message}`);
            });
        }
    }
}