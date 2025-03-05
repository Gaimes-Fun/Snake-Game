import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { colyseusClient } from '../../services/ColyseusClient';
import { Room } from 'colyseus.js';

interface GameSceneData {
    playerName: string;
    skinId: number;
}

export class GameScene extends Scene {
    // Game state
    private room: Room;
    private playerId: string;
    private playerName: string;
    private skinId: number;
    private gameState: any;
    private lastUpdateTime: number = 0;
    
    // Game objects
    private snakes: Map<string, Phaser.GameObjects.Group> = new Map();
    private foods: Map<string, Phaser.GameObjects.Image> = new Map();
    private playerTexts: Map<string, Phaser.GameObjects.Text> = new Map();
    
    // Camera and world
    private worldWidth: number = 4000;
    private worldHeight: number = 4000;
    
    // UI elements
    private scoreText: Phaser.GameObjects.Text;
    private leaderboardPanel: Phaser.GameObjects.Container;
    private minimap: Phaser.GameObjects.Graphics;
    private deathOverlay: Phaser.GameObjects.Container;
    
    // Input
    private pointer: Phaser.Input.Pointer;
    
    // Audio
    private eatSound: Phaser.Sound.BaseSound;
    private deathSound: Phaser.Sound.BaseSound;
    
    // Add FPS counter
    private fpsText: Phaser.GameObjects.Text;
    private fpsUpdateTime: number = 0;
    
    // Add these properties to the class
    private targetCameraX: number = 0;
    private targetCameraY: number = 0;
    private cameraLerpFactor: number = 0.1; // Adjust between 0.05-0.2 for different smoothness
    
    constructor() {
        super('GameScene');
    }
    
    init(data: GameSceneData) {
        this.playerName = data.playerName || 'Player';
        this.skinId = data.skinId || 0;
    }
    
    async create() {
        // Set up world bounds
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        
        // Create background
        this.createBackground();
        
        // Set up input
        this.pointer = this.input.activePointer;
        
        // Set up UI
        this.createUI();
        
        // Set up audio
        this.eatSound = this.sound.add('eat');
        this.deathSound = this.sound.add('death');
        
        // Connect to server
        try {
            this.room = await colyseusClient.joinOrCreate('snake_game', {
                name: this.playerName,
                skinId: this.skinId
            });
            
            this.playerId = this.room.sessionId;
            
            // Set up room event handlers
            this.setupRoomHandlers();
            
            // Notify that the scene is ready
            EventBus.emit('current-scene-ready', this);
            
            console.log('Connected to game server!');
        } catch (error) {
            console.error('Failed to connect to game server:', error);
            this.scene.start('MenuScene');
        }
    }
    
    update(time: number, delta: number) {
        // Skip if not connected yet
        if (!this.room || !this.gameState) return;
        
        // Update FPS counter every 500ms
        if (time - this.fpsUpdateTime > 500) {
            this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
            this.fpsUpdateTime = time;
        }
        
        // Update game objects every frame for smoother animations
        this.updateSnakes();
        this.updateFoods();
        this.updatePlayerTexts();
        
        // Calculate angle from player's snake head to mouse pointer
        const player = this.gameState.players.get(this.playerId);
        if (player && player.alive) {
            const head = player.segments[0];
            
            // Convert screen coordinates to world coordinates
            const worldX = this.cameras.main.scrollX + this.pointer.x;
            const worldY = this.cameras.main.scrollY + this.pointer.y;
            
            // Calculate angle
            const angle = Phaser.Math.Angle.Between(
                head.position.x, 
                head.position.y,
                worldX,
                worldY
            );
            
            // Convert to degrees
            const angleDeg = Phaser.Math.RadToDeg(angle);
            
            // Send movement input to server
            this.room.send('move', { angle: angleDeg });
            
            // Update camera to follow player's head
            // this.cameras.main.centerOn(head.position.x, head.position.y);
        }
        
        // Update minimap
        this.updateMinimap();
        
        // // Update leaderboard
        // if (time - this.lastUpdateTime > 1000) { // Update every second
        //     this.updateLeaderboard();
        //     this.lastUpdateTime = time;
        // }
        
        this.updateCamera();
    }
    
    private setupRoomHandlers() {
        // Handle state changes
        this.room.onStateChange((state) => {
            this.gameState = state;
            
            // Update world size
            this.worldWidth = state.worldWidth;
            this.worldHeight = state.worldHeight;
            this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            
            // Update UI
            this.updateScore();
            this.updateLeaderboard();
        });
        
        // Handle player died event
        this.room.onMessage('playerDied', (message) => {
            if (message.playerId === this.playerId) {
                this.handlePlayerDeath();
            }
            
            // Play death sound
            this.deathSound.play();
        });
    }
    
    private createBackground() {
        // Create a tiled background
        const bgTexture = this.textures.get('background');
        const bgWidth = bgTexture.getSourceImage().width;
        const bgHeight = bgTexture.getSourceImage().height;
        
        // Calculate how many tiles we need
        const tilesX = Math.ceil(this.worldWidth / bgWidth) + 1;
        const tilesY = Math.ceil(this.worldHeight / bgHeight) + 1;
        
        // Create the tiles
        for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                this.add.image(
                    x * bgWidth,
                    y * bgHeight,
                    'background'
                ).setOrigin(0, 0).setAlpha(0.5);
            }
        }
        
        // Add a grid pattern
        const grid = this.add.grid(
            0, 0,
            this.worldWidth, this.worldHeight,
            100, 100,
            0x000000, 0,
            0xffffff, 0.1
        ).setOrigin(0, 0);
    }
    
    private createUI() {
        // Score text
        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0);
        
        // FPS counter
        this.fpsText = this.add.text(20, 60, 'FPS: 0', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0);
        
        // Create leaderboard
        this.createLeaderboard();
        
        // Create minimap
        this.createMinimap();
        
        // Create death overlay (hidden by default)
        this.createDeathOverlay();
    }
    
    private createLeaderboard() {
        const width = this.cameras.main.width;
        
        // Create container for leaderboard
        this.leaderboardPanel = this.add.container(width - 200, 20);
        this.leaderboardPanel.setScrollFactor(0);
        
        // Background
        const bg = this.add.rectangle(0, 0, 180, 220, 0x000000, 0.5);
        this.leaderboardPanel.add(bg);
        
        // Title
        const title = this.add.text(0, -90, 'Leaderboard', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        this.leaderboardPanel.add(title);
        
        // Placeholder for player entries (will be updated)
        for (let i = 0; i < 5; i++) {
            const entry = this.add.text(
                -80, -50 + i * 30,
                `${i + 1}. ---`,
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: '#ffffff'
                }
            );
            this.leaderboardPanel.add(entry);
        }
    }
    
    private createMinimap() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create minimap graphics
        this.minimap = this.add.graphics();
        this.minimap.setScrollFactor(0);
        this.minimap.x = width - 120;
        this.minimap.y = height - 120;
        
        // Add background
        this.minimap.fillStyle(0x000000, 0.5);
        this.minimap.fillRect(0, 0, 100, 100);
        
        // Add border
        this.minimap.lineStyle(2, 0xffffff, 0.8);
        this.minimap.strokeRect(0, 0, 100, 100);
    }
    
    private createDeathOverlay() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create container for death overlay
        this.deathOverlay = this.add.container(width / 2, height / 2);
        this.deathOverlay.setScrollFactor(0);
        this.deathOverlay.setVisible(false);
        
        // Background
        const bg = this.add.rectangle(0, 0, 400, 300, 0x000000, 0.8);
        this.deathOverlay.add(bg);
        
        // Death message
        const message = this.add.text(0, -80, 'You Died!', {
            fontFamily: 'Arial',
            fontSize: '36px',
            color: '#ff0000'
        }).setOrigin(0.5);
        this.deathOverlay.add(message);
        
        // Score display
        const scoreText = this.add.text(0, -20, 'Score: 0', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.deathOverlay.add(scoreText);
        
        // Respawn button
        const respawnButton = this.add.text(0, 60, 'Respawn', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#4CAF50',
            padding: {
                left: 20,
                right: 20,
                top: 10,
                bottom: 10
            }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        respawnButton.on('pointerover', () => {
            respawnButton.setScale(1.1);
        });
        
        respawnButton.on('pointerout', () => {
            respawnButton.setScale(1);
        });
        
        respawnButton.on('pointerdown', () => {
            // Send respawn message to server
            this.room.send('respawn');
            
            // Hide death overlay
            this.deathOverlay.setVisible(false);
        });
        
        this.deathOverlay.add(respawnButton);
        
        // Menu button
        const menuButton = this.add.text(0, 120, 'Main Menu', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#2196F3',
            padding: {
                left: 20,
                right: 20,
                top: 10,
                bottom: 10
            }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        menuButton.on('pointerover', () => {
            menuButton.setScale(1.1);
        });
        
        menuButton.on('pointerout', () => {
            menuButton.setScale(1);
        });
        
        menuButton.on('pointerdown', () => {
            // Disconnect from room
            if (this.room) {
                this.room.leave();
            }
            
            // Go back to menu
            this.scene.start('MenuScene');
        });
        
        this.deathOverlay.add(menuButton);
    }
    
    private updateSnakes() {
        if (!this.gameState) return;
        
        // Log current player's data to debug
        if (this.playerId) {
            const player = this.gameState.players.get(this.playerId);
            if (player) {
                console.log("Current player data:", player);
            } else {
                console.log("Player ID not found:", this.playerId);
                console.log("Available players:", Array.from(this.gameState.players.keys()));
            }
        }
        
        // First, remove snakes that are no longer in the game
        this.snakes.forEach((snake, id) => {
            const player = this.gameState.players.get(id);
            if (!player || !player.alive) {
                // Destroy all segments
                snake.destroy(true);
                this.snakes.delete(id);
                
                // Remove player name
                const playerText = this.playerTexts.get(id);
                if (playerText) {
                    playerText.destroy();
                    this.playerTexts.delete(id);
                }
            }
        });
        
        // Then, update or create snakes
        this.gameState.players.forEach((playerData: any, id: string) => {
            if (!playerData.alive) return;
            
            // Get segments and color
            const segments = playerData.segments || [];
            const color = playerData.color || '#ffffff';
            
            console.log(`Player ${id} has ${segments.length} segments, total length: ${playerData.totalLength}`);
            
            // Get or create snake group
            let snake = this.snakes.get(id);
            if (!snake) {
                snake = this.add.group();
                this.snakes.set(id, snake);
                
                // Create player name text
                const nameText = this.add.text(0, 0, playerData.name, {
                    fontFamily: 'Arial',
                    fontSize: '14px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 3
                }).setOrigin(0.5, 0.5);
                this.playerTexts.set(id, nameText);
            }
            
            // Update existing segments or create new ones
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (!segment || !segment.position) {
                    console.warn(`Invalid segment at index ${i}:`, segment);
                    continue;
                }
                
                const segmentObj = snake.getChildren()[i] as Phaser.GameObjects.Image;
                
                if (segmentObj) {
                    // Apply interpolation for smoother movement
                    // Use a faster lerp factor for the head, slower for the tail
                    const lerpFactor = i === 0 ? 0.3 : 0.2 - (i * 0.01);
                    
                    // Get current position
                    const currentX = segmentObj.x;
                    const currentY = segmentObj.y;
                    
                    // Calculate interpolated position
                    const newX = currentX + (segment.position.x - currentX) * lerpFactor;
                    const newY = currentY + (segment.position.y - currentY) * lerpFactor;
                    
                    // Update position
                    segmentObj.setPosition(newX, newY);
                } else {
                    // Create new segment
                    const isHead = i === 0;
                    const texture = isHead ? 'snake-head' : 'snake-body';
                    const newSegment = this.add.image(
                        segment.position.x,
                        segment.position.y,
                        texture
                    );
                    
                    // Apply color tint
                    newSegment.setTint(parseInt(color.replace('#', '0x')));
                    
                    // Add to snake group
                    snake.add(newSegment);
                    
                    // Make head face the right direction
                    if (isHead) {
                        newSegment.setOrigin(0.5, 0.5);
                    }
                }
            }
            
            // Remove extra segments if snake has shrunk
            const children = snake.getChildren();
            if (children.length > segments.length) {
                for (let i = segments.length; i < children.length; i++) {
                    children[i].destroy();
                }
            }
            
            // Update head rotation based on angle
            const head = snake.getChildren()[0] as Phaser.GameObjects.Image;
            if (head) {
                head.setRotation(Phaser.Math.DegToRad(playerData.angle + 90));
            }
        });
    }
    
    private updateFoods() {
        if (!this.gameState || !this.gameState.foods) return;
        
        // First, handle removed foods
        this.foods.forEach((foodSprite, foodId) => {
            if (!this.gameState.foods.has(foodId)) {
                foodSprite.destroy();
                this.foods.delete(foodId);
            }
        });
        
        // Then, add or update existing foods
        // Use forEach method of MapSchema instead of Object.entries
        this.gameState.foods.forEach((foodData, foodId) => {
            // Add null/undefined check to prevent errors
            if (!foodData || !foodData.position) {
                console.warn(`Food ${foodId} has invalid data:`, foodData);
                return; // Skip this food
            }
            
            const { position, value } = foodData;
            
            // Make sure position has x and y properties
            if (position.x === undefined || position.y === undefined) {
                console.warn(`Food ${foodId} has invalid position:`, position);
                return; // Skip this food
            }
            
            if (!this.foods.has(foodId)) {
                // Create new food sprite
                const foodSprite = this.add.image(position.x, position.y, value > 1 ? 'special-food' : 'food');
                foodSprite.setDepth(5);
                this.foods.set(foodId, foodSprite);
            } else {
                // Update existing food sprite
                const foodSprite = this.foods.get(foodId);
                foodSprite.setPosition(position.x, position.y);
                
                // Update texture if value changed
                if ((value > 1 && foodSprite.texture.key !== 'special-food') || 
                    (value === 1 && foodSprite.texture.key !== 'food')) {
                    foodSprite.setTexture(value > 1 ? 'special-food' : 'food');
                }
            }
        });
    }
    
    private updateScore() {
        if (!this.gameState || !this.playerId) return;
        
        const player = this.gameState.players.get(this.playerId);
        if (player) {
            this.scoreText.setText(`Score: ${player.score}`);
        }
    }
    
    private updateLeaderboard() {
        if (!this.gameState || !this.playerId) return;
        
        // Get all players
        const players = Array.from(this.gameState.players.values());
        
        // Check if players array exists and has elements
        if (!players || !Array.isArray(players) || players.length === 0) {
            // Handle empty leaderboard case
            for (let i = 0; i < 5; i++) {
                const entry = this.leaderboardPanel.getByName(`leaderboard-entry-${i}`) as Phaser.GameObjects.Text;
                if (entry) {
                    entry.setText(`${i + 1}. ---`);
                    entry.setColor('#ffffff');
                }
            }
            return;
        }
        
        // Sort players by score (descending)
        const sortedPlayers = [...players].sort((a, b) => {
            // Add null checks for a and b
            if (!a || !b) return 0;
            if (!a.score) return 1;
            if (!b.score) return -1;
            return b.score - a.score;
        });
        
        // Update leaderboard entries
        for (let i = 0; i < 5; i++) {
            const entry = this.leaderboardPanel.getByName(`leaderboard-entry-${i}`) as Phaser.GameObjects.Text;
            if (!entry) continue;
            
            const player = sortedPlayers[i];
            if (player) {
                const isCurrentPlayer = player.id === this.playerId;
                
                // Format name to fit
                let name = player.name || 'Unknown';
                if (name.length > 10) {
                    name = name.substring(0, 8) + '..';
                }
                
                // Update text
                entry.setText(`${i + 1}. ${name}: ${player.score || 0}`);
                
                // Highlight current player
                if (isCurrentPlayer) {
                    entry.setColor('#ffff00');
                } else {
                    entry.setColor('#ffffff');
                }
            } else {
                // No player for this entry
                entry.setText(`${i + 1}. ---`);
                entry.setColor('#ffffff');
            }
        }
    }
    
    private updateMinimap() {
        if (!this.gameState) return;
        
        // Clear minimap
        this.minimap.clear();
        
        // Draw background
        this.minimap.fillStyle(0x000000, 0.5);
        this.minimap.fillRect(0, 0, 100, 100);
        
        // Draw border
        this.minimap.lineStyle(2, 0xffffff, 0.8);
        this.minimap.strokeRect(0, 0, 100, 100);
        
        // Draw players
        Object.entries(this.gameState.players).forEach(([id, playerData]: [string, any]) => {
            if (!playerData.alive) return;
            
            // Get head position
            const head = playerData.segments[0];
            if (!head) return;
            
            // Scale world coordinates to minimap
            const x = (head.position.x / this.worldWidth) * 100;
            const y = (head.position.y / this.worldHeight) * 100;
            
            // Draw dot for player
            const isCurrentPlayer = id === this.playerId;
            const color = isCurrentPlayer ? 0xffff00 : parseInt(playerData.color.replace('#', '0x'));
            const size = isCurrentPlayer ? 4 : 3;
            
            this.minimap.fillStyle(color, 1);
            this.minimap.fillCircle(x, y, size);
        });
        
        // Draw current view area
        const camera = this.cameras.main;
        const viewX = (camera.scrollX / this.worldWidth) * 100;
        const viewY = (camera.scrollY / this.worldHeight) * 100;
        const viewWidth = (camera.width / this.worldWidth) * 100;
        const viewHeight = (camera.height / this.worldHeight) * 100;
        
        this.minimap.lineStyle(1, 0xffffff, 0.5);
        this.minimap.strokeRect(viewX, viewY, viewWidth, viewHeight);
    }
    
    private handlePlayerDeath() {
        // Show death overlay
        this.deathOverlay.setVisible(true);
        
        // Update score on death screen
        const player = this.gameState.players.get(this.playerId);
        if (player) {
            const scoreText = this.deathOverlay.getByName('scoreText') as Phaser.GameObjects.Text;
            if (scoreText) {
                scoreText.setText(`Score: ${player.score}`);
            }
        }
        
        // Play death sound
        this.deathSound.play();
    }
    
    private updateCamera() {
        if (!this.gameState || !this.playerId) return;
        
        const player = this.gameState.players.get(this.playerId);
        if (player && player.alive && player.segments.length > 0) {
            const head = player.segments[0];
            if (head && head.position) {
                // Set target camera position to player's head
                this.targetCameraX = head.position.x;
                this.targetCameraY = head.position.y;
                
                // Get current camera position
                const currentX = this.cameras.main.scrollX + this.cameras.main.width / 2;
                const currentY = this.cameras.main.scrollY + this.cameras.main.height / 2;
                
                // Calculate interpolated position
                const newX = currentX + (this.targetCameraX - currentX) * this.cameraLerpFactor;
                const newY = currentY + (this.targetCameraY - currentY) * this.cameraLerpFactor;
                
                // Center camera on interpolated position
                this.cameras.main.centerOn(newX, newY);
            }
        }
    }
    
    // Update the player text position with interpolation
    private updatePlayerTexts() {
        if (!this.gameState) return;
        
        this.playerTexts.forEach((text, playerId) => {
            const player = this.gameState.players.get(playerId);
            if (player && player.alive && player.segments.length > 0) {
                const head = player.segments[0];
                if (head && head.position) {
                    // Apply smoother interpolation for text
                    const lerpFactor = 0.2;
                    
                    // Get current position
                    const currentX = text.x;
                    const currentY = text.y;
                    
                    // Target position (above the head)
                    const targetX = head.position.x;
                    const targetY = head.position.y - 30;
                    
                    // Calculate interpolated position
                    const newX = currentX + (targetX - currentX) * lerpFactor;
                    const newY = currentY + (targetY - currentY) * lerpFactor;
                    
                    // Update position
                    text.setPosition(newX, newY);
                }
            }
        });
    }
} 