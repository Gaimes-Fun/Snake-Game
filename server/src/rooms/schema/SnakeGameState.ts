import { Schema, type, MapSchema, ArraySchema, Encoder } from "@colyseus/schema";
Encoder.BUFFER_SIZE = 1024 * 1024; // 1 MB
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
    
    // Remove the @type decorator to prevent automatic synchronization
    segments = new ArraySchema<SnakeSegment>();
    
    @type("number") totalLength: number = 5;
    
    @type("boolean") boosting: boolean = false;
    @type("number") boostTime: number = 0;
    
    // Add head position to sync only the head
    @type(Vector2) headPosition: Vector2;

    constructor(id: string, name: string, x: number, y: number, color: string) {
        super();
        this.id = id;
        this.name = name;
        this.color = color;
        this.totalLength = 5;
        this.headPosition = new Vector2(x, y);
        
        // Initialize snake with 5 segments
        for (let i = 0; i < 5; i++) {
            this.segments.push(new SnakeSegment(x - i * 20, y));
        }
    }

    get head(): Vector2 {
        return this.segments[0].position;
    }

    addSegment() {
        const lastSegment = this.segments[this.segments.length - 1];
        const newSegment = new SnakeSegment(
            lastSegment.position.x,
            lastSegment.position.y
        );
        this.segments.push(newSegment);
    }
    
    // Add method to update head position
    updateHeadPosition() {
        if (this.segments.length > 0) {
            this.headPosition.x = this.segments[0].position.x;
            this.headPosition.y = this.segments[0].position.y;
        }
    }
}

export class SnakeGameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    
    // Remove the type decorator for foods to prevent automatic synchronization
    foods = new MapSchema<Food>();
    
    @type("number") worldWidth: number = 8000;
    @type("number") worldHeight: number = 8000;
    @type("number") maxFoods: number = 1000; 
    @type("number") tickRate: number = 16; // ms per tick
    
    // Add a timestamp for client-side interpolation
    @type("number") timestamp: number = 0;
} 