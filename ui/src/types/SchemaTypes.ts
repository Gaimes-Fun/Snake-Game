// Define the Player interface to match the server schema
export interface Player {
    id: string;
    name: string;
    score: number;
    alive: boolean;
    color: string;
    skinId: number;
    angle: number;
    speed: number;
    boosting: boolean;
    kills: number;
    headPosition: {
        x: number;
        y: number;
    };
    segments?: Array<{
        position: {
            x: number;
            y: number;
        }
    }>;
} 