import { Client, Room } from 'colyseus.js';
import { EventBus } from '../game/EventBus';
import { ENV } from '../configs/env';

// Environment variables
const COLYSEUS_SERVER_URL = ENV.COLYSEUS_SERVER_URL || 'ws://localhost:2567';

class ColyseusClientService {
    private client: Client;
    private rooms: Map<string, Room> = new Map();

    constructor() {
        this.client = new Client(COLYSEUS_SERVER_URL);
        console.log(`Colyseus client initialized with server URL: ${COLYSEUS_SERVER_URL}`);
    }

    async joinOrCreate(roomName: string, options: any = {}): Promise<Room> {
        try {
            const room = await this.client.joinOrCreate(roomName, options);
            
            // Store room reference
            this.rooms.set(roomName, room);
            
            // Set up disconnect handler
            room.onLeave((code) => {
                console.log(`Left room ${roomName} with code ${code}`);
                this.rooms.delete(roomName);
                EventBus.emit('room-disconnected', { roomName, code });
            });
            
            // Emit event
            EventBus.emit('room-joined', { roomName, sessionId: room.sessionId });
            
            return room;
        } catch (error) {
            console.error(`Error joining room ${roomName}:`, error);
            throw error;
        }
    }

    getRoom(roomName: string): Room | undefined {
        return this.rooms.get(roomName);
    }

    leaveAllRooms() {
        this.rooms.forEach(room => {
            room.leave();
        });
        this.rooms.clear();
    }
}

// Export a singleton instance
export const colyseusClient = new ColyseusClientService(); 