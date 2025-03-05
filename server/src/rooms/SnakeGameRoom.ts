import { Room, Client, Delayed } from "@colyseus/core";
import { SnakeGameState, Player, Food, Vector2 } from "./schema/SnakeGameState";

export class SnakeGameRoom extends Room<SnakeGameState> {
    maxClients = 50;
    tickRate = 16; // Changed from 20 to 16 ms (approximately 60 FPS)
    gameLoopInterval: Delayed;
    
    // Colors for snakes
    private colors = [
        "#FF5733", "#33FF57", "#3357FF", "#F3FF33", 
        "#FF33F3", "#33FFF3", "#F333FF", "#FF3333"
    ];

    // Math constants
    private readonly PI = Math.PI;
    private readonly DEG_TO_RAD = Math.PI / 180;

    onCreate(options: any) {
        this.setState(new SnakeGameState());
        this.state.tickRate = this.tickRate;
        
        // Set up message handlers
        this.onMessage("move", (client, message: { angle: number }) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.alive) {
                player.angle = message.angle;
            }
        });

        this.onMessage("respawn", (client) => {
            this.respawnPlayer(client);
        });
        
        // Add handler for playground message types
        this.onMessage("*", (client, type, message) => {
            // This is a catch-all handler for any message type
            // We don't need to do anything here, but it will prevent the warning
            console.log(`Received message of type: ${type}`);
        });

        // Initialize food
        this.initializeFood();
        
        // Start game loop
        this.gameLoopInterval = this.clock.setInterval(() => {
            this.gameLoop();
        }, this.tickRate);
    }

    onJoin(client: Client, options: { name: string, skinId?: number }) {
        console.log(`${client.sessionId} joined with options:`, options);
        
        // Create a new player
        const spawnPosition = this.getRandomPosition();
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        
        console.log(`Spawning player at position: ${spawnPosition.x}, ${spawnPosition.y} with color: ${color}`);
        
        const player = new Player(
            client.sessionId,
            options.name || `Player ${client.sessionId.substr(0, 4)}`,
            spawnPosition.x,
            spawnPosition.y,
            color
        );
        
        if (options.skinId !== undefined) {
            player.skinId = options.skinId;
        }
        
        this.state.players.set(client.sessionId, player);
        console.log(`Player created with ID: ${client.sessionId}, segments: ${player.segments.length}`);
        
        // Send a welcome message to the client
        this.send(client, "welcome", { 
            id: client.sessionId,
            position: spawnPosition,
            color: color
        });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(`${client.sessionId} left!`);
        this.state.players.delete(client.sessionId);
    }

    onDispose() {
        console.log("Room disposed!");
        this.gameLoopInterval.clear();
    }

    private gameLoop() {
        // Update all players
        this.state.players.forEach(player => {
            if (!player.alive) return;
            
            this.movePlayer(player);
            this.checkFoodCollisions(player);
            this.checkPlayerCollisions(player);
        });
        
        // Replenish food if needed
        if (this.state.foods.size < this.state.maxFoods) {
            this.spawnFood();
        }
    }

    private movePlayer(player: Player) {
        if (!player.alive || player.segments.length === 0) return;
        
        // Get the head segment
        const head = player.segments[0];
        
        // Calculate new position based on angle and speed
        // Convert degrees to radians manually instead of using Phaser
        const angleRad = player.angle * this.DEG_TO_RAD;
        const speedMultiplier = 1.5; // Add a speed multiplier for faster movement
        const dx = Math.cos(angleRad) * player.speed * speedMultiplier;
        const dy = Math.sin(angleRad) * player.speed * speedMultiplier;
        
        // Create a new position for the head
        const newX = this.wrapCoordinate(head.position.x + dx, this.state.worldWidth);
        const newY = this.wrapCoordinate(head.position.y + dy, this.state.worldHeight);
        
        // Move each segment to the position of the segment in front of it
        for (let i = player.segments.length - 1; i > 0; i--) {
            const segment = player.segments[i];
            const prevSegment = player.segments[i - 1];
            
            segment.position.x = prevSegment.position.x;
            segment.position.y = prevSegment.position.y;
        }
        
        // Update the head position
        head.position.x = newX;
        head.position.y = newY;
    }

    private checkFoodCollisions(player: Player) {
        const head = player.head;
        const headRadius = 10; // Approximate head radius
        
        this.state.foods.forEach((food, foodId) => {
            const dx = head.x - food.position.x;
            const dy = head.y - food.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If collision detected
            if (distance < headRadius + 5) { // 5 is approximate food radius
                // Add score
                player.score += food.value;
                
                // Grow snake
                player.addSegment();
                
                // Remove food
                this.state.foods.delete(foodId);
                
                // Spawn new food
                this.spawnFood();
            }
        });
    }

    private checkPlayerCollisions(player: Player) {
        if (!player.alive) return;
        
        const head = player.head;
        const headRadius = 10;
        
        // Check collisions with other players
        this.state.players.forEach((otherPlayer) => {
            if (otherPlayer.id === player.id || !otherPlayer.alive) return;
            
            // Skip the head of the other player (index 0)
            for (let i = 1; i < otherPlayer.segments.length; i++) {
                const segment = otherPlayer.segments[i];
                const dx = head.x - segment.position.x;
                const dy = head.y - segment.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < headRadius + 8) { // 8 is approximate segment radius
                    this.killPlayer(player);
                    
                    // Add score to the player who was hit
                    otherPlayer.score += Math.floor(player.score / 2);
                    
                    // Spawn food from dead player
                    this.spawnFoodFromDeadPlayer(player);
                    return;
                }
            }
        });
        
        // Check self-collision (skip the first few segments)
        for (let i = 5; i < player.segments.length; i++) {
            const segment = player.segments[i];
            const dx = head.x - segment.position.x;
            const dy = head.y - segment.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < headRadius - 2) { // Slightly smaller to avoid false positives
                this.killPlayer(player);
                this.spawnFoodFromDeadPlayer(player);
                return;
            }
        }
    }

    private killPlayer(player: Player) {
        player.alive = false;
        
        // Notify client that player died
        this.broadcast("playerDied", { playerId: player.id });
    }

    private respawnPlayer(client: Client) {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        
        // Reset player
        const spawnPosition = this.getRandomPosition();
        player.alive = true;
        player.score = 0;
        player.segments.clear();
        
        // Initialize snake with 5 segments
        const initialSegments = 5;
        for (let i = 0; i < initialSegments; i++) {
            player.segments.push({
                position: new Vector2(spawnPosition.x - i * 20, spawnPosition.y)
            });
        }
    }

    private spawnFoodFromDeadPlayer(player: Player) {
        // Spawn food at each segment position
        const foodPerSegment = Math.min(Math.floor(player.segments.length / 3), 20);
        
        for (let i = 0; i < foodPerSegment; i++) {
            const segmentIndex = Math.floor(Math.random() * player.segments.length);
            const segment = player.segments[segmentIndex];
            
            const foodId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const food = new Food(
                foodId,
                segment.position.x + (Math.random() * 40 - 20),
                segment.position.y + (Math.random() * 40 - 20),
                1
            );
            
            this.state.foods.set(foodId, food);
        }
    }

    private initializeFood() {
        // Spawn initial food
        for (let i = 0; i < this.state.maxFoods; i++) {
            this.spawnFood();
        }
    }

    private spawnFood() {
        const position = this.getRandomPosition();
        const foodId = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Occasionally spawn higher value food (5% chance)
        const value = Math.random() < 0.05 ? 5 : 1;
        
        const food = new Food(foodId, position.x, position.y, value);
        this.state.foods.set(foodId, food);
    }

    private getRandomPosition() {
        return {
            x: Math.random() * this.state.worldWidth,
            y: Math.random() * this.state.worldHeight
        };
    }

    private wrapCoordinate(value: number, max: number): number {
        if (value < 0) return max + (value % max);
        if (value >= max) return value % max;
        return value;
    }
} 