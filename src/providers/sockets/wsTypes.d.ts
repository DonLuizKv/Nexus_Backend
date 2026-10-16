
export type ActiveUsers = {
    userUID: string,
    socketUID: Socket
}

export type Package = {
    type: "direct" | "broadcast";
    to: string | Channel[];
    message: Message;
}

export type Channel = "user" | "students" | "admins";
export type Message = Record<string, string | number | boolean> | string;
