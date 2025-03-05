import { Schema, Context, type, MapSchema, ArraySchema } from "@colyseus/schema";

// Simple position class without Schema inheritance to reduce overhead
export class Vector2 extends Schema {
    @type("number") x: number;
    @type("number") y: number;

    constructor(x: number = 0, y: number = 0) {
        super();
        this.x = x;
        this.y = y;
    }
}

export class Food extends Schema {
    @type("string") id: string;
    @type(Vector2) position: Vector2;
    @type("number") value: number;

    constructor(id: string, x: number, y: number, value: number = 1) {
        super();
        this.id = id;
        this.position = new Vector2(x, y);
        this.value = value;
    }
}

export class SnakeSegment extends Schema {
    @type(Vector2) position: Vector2;

    constructor(x: number, y: number) {
        super();
        this.position = new Vector2(x, y);
    }
}

export class Player extends Schema {
    @type("string") id: string;
    @type("string") name: string;
    @type("number") score: number = 0;
    @type("number") angle: number = 0;
    @type("number") speed: number = 5;
    @type("string") color: string;
    @type("boolean") alive: boolean = true;
    @type("number") skinId: number = 0;
    
    // Only sync the first 20 segments - client can interpolate the rest
    @type([SnakeSegment]) segments = new ArraySchema<SnakeSegment>();
    
    // Store the total length separately - this allows the client to know how long
    // the snake should be without syncing all segments
    @type("number") totalLength: number = 5;
    
    // Maximum number of segments to sync (prevents buffer overflow)
    private readonly MAX_SYNC_SEGMENTS = 20;

    constructor(id: string, name: string, x: number, y: number, color: string) {
        super();
        this.id = id;
        this.name = name;
        this.color = color;
        this.totalLength = 5;
        
        // Initialize snake with 5 segments
        const initialSegments = Math.min(5, this.MAX_SYNC_SEGMENTS);
        for (let i = 0; i < initialSegments; i++) {
            this.segments.push(new SnakeSegment(x - i * 20, y));
        }
    }

    get head(): Vector2 {
        return this.segments[0].position;
    }

    addSegment() {
        this.totalLength++;
        
        // Only add a new segment to the array if we're below the sync limit
        if (this.segments.length < this.MAX_SYNC_SEGMENTS) {
            const lastSegment = this.segments[this.segments.length - 1];
            const newSegment = new SnakeSegment(
                lastSegment.position.x,
                lastSegment.position.y
            );
            this.segments.push(newSegment);
        }
    }
}

export class SnakeGameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Food }) foods = new MapSchema<Food>();
    @type("number") worldWidth: number = 4000;
    @type("number") worldHeight: number = 4000;
    @type("number") maxFoods: number = 50; // Further reduced to prevent buffer overflow
    @type("number") tickRate: number = 20; // ms per tick
    
    // Add a timestamp for client-side interpolation
    @type("number") timestamp: number = 0;
} 