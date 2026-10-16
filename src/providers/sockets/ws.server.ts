import type http from 'http';
import { Server, Socket } from "socket.io";
import { ActiveUsers } from './wsTypes';
import { Logger } from '../logs/Logger';

type WSServerConfig = {
    origins: string[];
    httpServer: http.Server;
}

export class WebSocketServer {
    protected io!: Server;
    private ActiveUsers = new Map<string, Socket>();
    private usersSessions: number = 0;
    private config: WSServerConfig;

    constructor(config: WSServerConfig) {
        this.config = config;
    }

    public getActiveUsers(): ActiveUsers[] {
        return Array.from(this.ActiveUsers.entries()).map(([userUID, socketUID]) => ({ userUID, socketUID }))
    }

    initialize() {
        this.io = new Server(this.config.httpServer, {
            transports: ["websocket"],
            maxHttpBufferSize: 1e6, // 1 MB por defectoF
            cors: {
                origin: this.config.origins,
                methods: ["GET", "POST"],
                credentials: true,
            },
        });

        Logger.socket("WebSocket Server is running");

        this.io.on('connection', (socket: Socket) => {
            this.connectUser(socket);
            this.dispatcher(socket);

            socket.on('disconnect', () => this.disconnectUser(socket));
            socket.on("error", (data: Error) => this.errorUser(socket, data));
        });
    }

    private connectUser(socket: Socket) {
        this.ActiveUsers.set(socket.id, socket);
        this.usersSessions++;
        Logger.socket(`Users Connected: ${this.usersSessions}`);
    }

    private disconnectUser(socket: Socket) {
        this.ActiveUsers.delete(socket.id);
        this.usersSessions--;
        Logger.socket(`Users Connected: ${this.usersSessions}`);
    }

    private errorUser(socket: Socket, data: Error) {
        Logger.error(data);
        socket.emit("error", data);
    }

    private dispatcher(socket: Socket) {
        // const events = new Dispatcher(this.io, socket, this.ActiveUsers);
        // events.init();
    }
}