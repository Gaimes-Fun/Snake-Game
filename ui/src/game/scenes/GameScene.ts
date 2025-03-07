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
    private worldWidth: number = 8000;
    private worldHeight: number = 8000;
    
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
    private boostSound: Phaser.Sound.BaseSound;
    
    // Add FPS counter
    private fpsText: Phaser.GameObjects.Text;
    private fpsUpdateTime: number = 0;
    
    // Add these properties to the class
    private targetCameraX: number = 0;
    private targetCameraY: number = 0;
    private cameraLerpFactor: number = 0.1; // Adjust between 0.05-0.2 for different smoothness
    
    // Add these properties to the class
    private respawnButton: Phaser.GameObjects.Text;
    private menuButton: Phaser.GameObjects.Text;
    
    // Add these properties to the class
    private isBoosting: boolean = false;
    private boostEffect: Phaser.GameObjects.Particles.ParticleEmitter;
    
    // Add this new property
    private playerCountText: Phaser.GameObjects.Text;
    
    // Add this property to the class
    private backgroundMusic: Phaser.Sound.BaseSound;
    
    // Add this property to the class
    private playerRankText: Phaser.GameObjects.Text;
    
    constructor() {
        super({
            key: 'GameScene',
            physics: {
                default: 'arcade',
                arcade: {
                    debug: false
                }
            }
        });
    }
    
    init(data: GameSceneData) {
        this.playerName = data.playerName || 'Player';
        this.skinId = data.skinId || 0;
    }
    
    async create() {
        // Set up world bounds - with safety check
        this.cameras.main?.setBounds(0, 0, this.worldWidth, this.worldHeight);
        
        // Add safety check for physics world
        if (this.physics && this.physics.world) {
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        } else {
            console.warn('Physics system not available, skipping world bounds setup');
        }
        
        // Create background
        this.createBackground();
        
        // Set up input
        this.pointer = this.input.activePointer;
        
        // Set up UI
        this.createUI();
        
        // Set up audio
        this.setupAudio();
        
        // Set up input for boost
        this.input.on('pointerdown', () => {
            this.startBoost();
        });
        
        this.input.on('pointerup', () => {
            this.stopBoost();
        });
        
        // Create boost particle effect
        this.createBoostEffect();
        
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
            
            // Update boost effect position if boosting
            if (player.boosting) {
                this.updateBoostEffect(head.position.x, head.position.y, angleDeg);
            }
            
            // Apply food attraction logic
            this.attractFoodInFront(head.position.x, head.position.y, angleDeg);
        }
        
        // Update minimap
        this.updateMinimap();
        
        // Update leaderboard every second
        if (time - this.lastUpdateTime > 1000) { // Update every second
            this.updateLeaderboard();
            this.lastUpdateTime = time;
        }
        
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
            
            // Add safety check for physics world
            if (this.physics && this.physics.world) {
                this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            }
            
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
        
        // Handle initial foods message
        this.room.onMessage('initialFoods', (message) => {
            console.log(`Received ${message.foods.length} initial foods`);
            
            // Clear existing foods
            this.foods.forEach(food => food.destroy());
            this.foods.clear();
            
            // Add all initial foods
            message.foods.forEach((food: any) => {
                const foodSprite = this.createFoodSprite(food.id, food.position.x, food.position.y, food.value);
                this.foods.set(food.id, foodSprite);
            });
        });
        
        // Add handler for food spawned
        this.room.onMessage("foodSpawned", (message) => {
            // Create food sprite if it doesn't exist
            if (!this.foods.has(message.id)) {
                const foodSprite = this.createFoodSprite(message.id, message.position.x, message.position.y, message.value);
                this.foods.set(message.id, foodSprite);
            }
        });
        
        // Add handler for food consumed
        this.room.onMessage("foodConsumed", (message) => {
            // Remove food sprite if it exists
            const foodSprite = this.foods.get(message.id);
            if (foodSprite) {
                foodSprite.destroy();
                this.foods.delete(message.id);
                
                // Play eat sound only if it's the current player who ate the food
                if (message.playerId === this.playerId) {
                    this.eatSound.play({ volume: 0.5 });
                }
            }
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
        
        // Add player rank text
        this.playerRankText = this.add.text(20, 60, 'Rank: -', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0);
        
        // FPS counter - move down to accommodate rank text
        this.fpsText = this.add.text(20, 100, 'FPS: 0', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0);
        
        // Add player count text - move down to accommodate rank text
        this.playerCountText = this.add.text(20, 140, 'Players: 0', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0);
        
        // Create leaderboard
        this.createLeaderboard();
        
        // Create minimap
        this.createMinimap();
        
        // Create death overlay (hidden by default)
        this.createDeathOverlay();
        
        // Add music toggle button
        const musicButton = this.add.text(this.cameras.main.width - 20, 20, '🔊', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(1, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
        
        musicButton.on('pointerdown', () => {
            this.toggleMusic();
            musicButton.setText(this.backgroundMusic.isPlaying ? '🔊' : '🔇');
        });
    }
    
    private createLeaderboard() {
        const width = this.cameras.main.width;
        
        // Create container for leaderboard - increase top margin even more
        this.leaderboardPanel = this.add.container(width - 200, 80);
        this.leaderboardPanel.setScrollFactor(0);
        
        // Background - make it slightly larger and more transparent
        const bg = this.add.rectangle(0, 0, 190, 230, 0x000000, 0.4);
        this.leaderboardPanel.add(bg);
        
        // Title - adjust position and style
        const title = this.add.text(0, -90, 'Leaderboard', {
            fontFamily: 'Arial',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);
        this.leaderboardPanel.add(title);
        
        // Placeholder for player entries - increase spacing
        for (let i = 0; i < 5; i++) {
            const entry = this.add.text(
                -80, -50 + i * 35,  // Increased vertical spacing from 30 to 35
                `${i + 1}. ---`,
                {
                    fontFamily: 'Arial',
                    fontSize: '16px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 1
                }
            ).setName(`leaderboard-entry-${i}`);
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
        this.deathOverlay.setDepth(1000); // Set a very high depth to ensure it's on top
        
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
        }).setOrigin(0.5).setName('scoreText');
        this.deathOverlay.add(scoreText);
        
        // Create buttons outside the container first
        // Respawn button - create directly in the scene, not in the container
        this.respawnButton = this.add.text(width / 2, height / 2 + 60, 'Respawn', {
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
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setName('respawnButton')
        .setDepth(1001) // Higher than container
        .setScrollFactor(0)
        .setVisible(false);
        
        this.respawnButton.on('pointerover', () => {
            this.respawnButton.setScale(1.1);
        });
        
        this.respawnButton.on('pointerout', () => {
            this.respawnButton.setScale(1);
        });
        
        this.respawnButton.on('pointerdown', () => {
            console.log('Respawn button clicked');
            // Send respawn message to server
            this.room.send('respawn');
            
            // Hide death overlay and buttons
            this.deathOverlay.setVisible(false);
            this.respawnButton.setVisible(false);
            this.menuButton.setVisible(false);
        });
        
        // Menu button - create directly in the scene, not in the container
        this.menuButton = this.add.text(width / 2, height / 2 + 120, 'Main Menu', {
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
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setName('menuButton')
        .setDepth(1001) // Higher than container
        .setScrollFactor(0)
        .setVisible(false);
        
        this.menuButton.on('pointerover', () => {
            this.menuButton.setScale(1.1);
        });
        
        this.menuButton.on('pointerout', () => {
            this.menuButton.setScale(1);
        });
        
        this.menuButton.on('pointerdown', () => {
            console.log('Menu button clicked');
            // Disconnect from room
            if (this.room) {
                this.room.leave();
            }
            
            // Go back to menu
            this.scene.start('MenuScene');
        });
    }
    
    private createBoostEffect() {
        // Create particle emitter for boost effect
        if (this.game.textures.exists('boost-particle')) {
            this.boostEffect = this.add.particles(0, 0, 'boost-particle', {
                lifespan: 200,
                speed: { min: 50, max: 100 },
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                blendMode: 'ADD',
                emitting: false
            });
        } else {
            // Fallback if texture doesn't exist
            console.warn('Boost particle texture not found, using default');
            this.boostEffect = this.add.particles(0, 0, 'food', {
                lifespan: 200,
                speed: { min: 50, max: 100 },
                scale: { start: 0.5, end: 0 },
                alpha: { start: 0.7, end: 0 },
                blendMode: 'ADD',
                emitting: false
            });
        }
    }
    
    private updateBoostEffect(x: number, y: number, angle: number) {
        if (!this.boostEffect) return;
        
        // Position the emitter behind the snake head
        const offsetX = Math.cos((angle - 180) * Math.PI / 180) * 20;
        const offsetY = Math.sin((angle - 180) * Math.PI / 180) * 20;
        
        this.boostEffect.setPosition(x + offsetX, y + offsetY);
        this.boostEffect.setEmitterAngle(angle - 180);
    }
    
    private startBoost() {
        if (!this.room) return;
        
        this.isBoosting = true;
        this.room.send('boost', true);
        
        // Play boost sound
        this.boostSound.play({ volume: 0.3 });
        
        // Start particle effect
        if (this.boostEffect) {
            this.boostEffect.start();
        }
    }
    
    private stopBoost() {
        if (!this.room) return;
        
        this.isBoosting = false;
        this.room.send('boost', false);
        
        // Stop particle effect
        if (this.boostEffect) {
            this.boostEffect.stop();
        }
    }
    
    private updateSnakes() {
        if (!this.gameState) return;
        
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
            const skinId = playerData.skinId || 0;
            
            // Get or create snake group
            let snake = this.snakes.get(id);
            if (!snake) {
                snake = this.add.group();
                this.snakes.set(id, snake);
                
                // Create player name text
                const nameText = this.add.text(0, 0, playerData.name, {
                    fontFamily: 'Arial',
                    fontSize: '18px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4
                }).setOrigin(0.5, 0.5);
                nameText.setDepth(100);
                this.playerTexts.set(id, nameText);
            }
            
            // Make sure we have enough game objects for all segments
            const currentSegmentCount = snake.getChildren().length;
            if (currentSegmentCount < segments.length) {
                // Create new segments as needed
                for (let i = currentSegmentCount; i < segments.length; i++) {
                    const isHead = i === 0;
                    // Apply skin to texture name
                    const texture = isHead ? `snake-head-${skinId}` : `snake-body-${skinId}`;
                    
                    // Fallback to default textures if the skin-specific ones don't exist
                    const textureExists = this.textures.exists(texture);
                    const finalTexture = textureExists ? texture : (isHead ? 'snake-head' : 'snake-body');
                    
                    const newSegment = this.add.image(0, 0, finalTexture);
                    
                    // Apply color tint
                    newSegment.setTint(parseInt(color.replace('#', '0x')));
                    
                    // Add to snake group
                    snake.add(newSegment);
                    
                    // Make head face the right direction
                    if (isHead) {
                        newSegment.setOrigin(0.5, 0.5);
                    }
                    
                    // Set appropriate depths for snake segments
                    newSegment.setDepth(isHead ? 20 : 10);
                }
            } else if (currentSegmentCount > segments.length) {
                // Remove extra segments if snake has shrunk
                const children = snake.getChildren();
                for (let i = segments.length; i < children.length; i++) {
                    children[i].destroy();
                }
            }
            
            // Calculate base scale based on score - larger snakes for higher scores
            // Make it grow faster with a more aggressive formula
            const baseScale = Math.min(2.0, 1 + (playerData.score / 50));
            
            // Update all segment positions
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
                    const lerpFactor = i === 0 ? 0.3 : Math.max(0.05, 0.2 - (i * 0.01));
                    
                    // Get current position
                    const currentX = segmentObj.x;
                    const currentY = segmentObj.y;
                    
                    // Calculate interpolated position
                    const newX = currentX + (segment.position.x - currentX) * lerpFactor;
                    const newY = currentY + (segment.position.y - currentY) * lerpFactor;
                    
                    // Update position
                    segmentObj.setPosition(newX, newY);
                    
                    // Apply scale based on position in snake (head is largest)
                    const isHead = i === 0;
                    // Make the scaling more dramatic along the body
                    const segmentScale = isHead ? baseScale : baseScale * Math.max(0.6, 1 - (i * 0.02));
                    segmentObj.setScale(segmentScale);
                }
            }
            
            // Update head rotation based on angle
            const head = snake.getChildren()[0] as Phaser.GameObjects.Image;
            if (head) {
                head.setRotation(Phaser.Math.DegToRad(playerData.angle + 90));
                
                // Add visual effect for boosting
                if (playerData.boosting) {
                    head.setAlpha(0.8 + Math.sin(this.time.now * 0.01) * 0.2); // Pulsing effect
                    head.setScale(baseScale * 1.2); // Make head slightly larger when boosting
                } else {
                    head.setAlpha(1);
                    head.setScale(baseScale);
                }
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
        this.gameState.foods.forEach((foodData: any, foodId: string) => {
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
                const foodSprite = this.createFoodSprite(foodId, position.x, position.y, value);
                this.foods.set(foodId, foodSprite);
            } else {
                // Update existing food sprite
                const foodSprite = this.foods.get(foodId);
                if (foodSprite) {
                    // Apply the server position
                    foodSprite.setPosition(position.x, position.y);
                    
                    // Update texture if value changed
                    if ((value > 1 && foodSprite.texture.key !== 'special-food') || 
                        (value === 1 && foodSprite.texture.key !== 'food')) {
                        foodSprite.setTexture(value > 1 ? 'special-food' : 'food');
                    }
                }
            }
        });
    }
    
    private createFoodSprite(id: string, x: number, y: number, value: number): Phaser.GameObjects.Image {
        // Create food sprite with appropriate texture based on value
        const texture = value > 1 ? 'special-food' : 'food';
        const foodSprite = this.add.image(x, y, texture);
        
        // Set depth to ensure food appears below snakes
        foodSprite.setDepth(5);
        
        // Add a small scale animation for visual appeal
        this.tweens.add({
            targets: foodSprite,
            scale: { from: 0.8, to: 1.2 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        return foodSprite;
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
        
        // Get all players as an array
        const players: any[] = [];
        this.gameState.players.forEach((player: any, id: string) => {
            // Add the id to the player object for reference
            players.push({...player, id});
        });
        
        // Sort players by score (descending)
        const sortedPlayers = players.sort((a, b) => b.score - a.score);
        
        // Update player count
        this.playerCountText.setText(`Players: ${players.length}`);
        
        // Find current player's rank
        let playerRank = -1;
        for (let i = 0; i < sortedPlayers.length; i++) {
            if (sortedPlayers[i].id === this.playerId) {
                playerRank = i + 1;
                break;
            }
        }
        
        // Update player rank text
        if (playerRank > 0) {
            this.playerRankText.setText(`Rank: ${playerRank}/${players.length}`);
        } else {
            this.playerRankText.setText('Rank: -');
        }
        
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
        if (!this.gameState || !this.minimap) return;
        
        // Clear the minimap
        this.minimap.clear();
        
        // Draw the border
        this.minimap.lineStyle(2, 0xffffff, 0.8);
        this.minimap.strokeRect(0, 0, 150, 150);
        
        // Calculate scale factors
        const scaleX = 150 / this.worldWidth;
        const scaleY = 150 / this.worldHeight;
        
        // Draw world boundaries
        this.minimap.lineStyle(1, 0x444444, 0.5);
        this.minimap.strokeRect(0, 0, 150, 150);
        
        // Draw grid lines
        this.minimap.lineStyle(1, 0x444444, 0.3);
        for (let x = 0; x < this.worldWidth; x += this.worldWidth / 10) {
            const miniX = x * scaleX;
            this.minimap.moveTo(miniX, 0);
            this.minimap.lineTo(miniX, 150);
        }
        for (let y = 0; y < this.worldHeight; y += this.worldHeight / 10) {
            const miniY = y * scaleY;
            this.minimap.moveTo(0, miniY);
            this.minimap.lineTo(150, miniY);
        }
        
        // Draw food items (small dots) - Use the local foods Map instead of gameState.foods
        this.minimap.lineStyle(0, 0x000000, 0); // Add color and alpha parameters
        this.foods.forEach((foodSprite, foodId) => {
            if (!foodSprite) return;
            
            // Use grey color for all food with different sizes for special food
            const isSpecial = foodSprite.texture.key === 'special-food';
            const foodColor = 0x888888; // Grey color for all food
            const foodSize = isSpecial ? 3 : 2; // Double the size from previous values
            
            this.minimap.fillStyle(foodColor, 0.6); // Lower alpha for subtlety
            this.minimap.fillCircle(
                foodSprite.x * scaleX,
                foodSprite.y * scaleY,
                foodSize
            );
        });
        
        // Draw other players (small triangles)
        this.gameState.players.forEach((player: any, id: string) => {
            if (!player || !player.alive || id === this.playerId) return;
            
            if (player.segments && player.segments.length > 0) {
                const head = player.segments[0];
                if (!head || !head.position) return;
                
                // Convert hex color string to number
                const colorHex = parseInt(player.color.replace('#', '0x'));
                
                // Draw a small triangle for other players
                this.minimap.fillStyle(colorHex, 0.8);
                
                // Calculate triangle points based on player angle
                const angleRad = player.angle * (Math.PI / 180);
                const miniX = head.position.x * scaleX;
                const miniY = head.position.y * scaleY;
                const size = 4;
                
                // Calculate triangle points
                const x1 = miniX + Math.cos(angleRad) * size;
                const y1 = miniY + Math.sin(angleRad) * size;
                const x2 = miniX + Math.cos(angleRad + 2.5) * size;
                const y2 = miniY + Math.sin(angleRad + 2.5) * size;
                const x3 = miniX + Math.cos(angleRad - 2.5) * size;
                const y3 = miniY + Math.sin(angleRad - 2.5) * size;
                
                // Draw the triangle
                this.minimap.beginPath();
                this.minimap.moveTo(x1, y1);
                this.minimap.lineTo(x2, y2);
                this.minimap.lineTo(x3, y3);
                this.minimap.closePath();
                this.minimap.fillPath();
            }
        });
        
        // Draw current player (larger dot)
        const player = this.gameState.players.get(this.playerId);
        if (player && player.alive && player.segments && player.segments.length > 0) {
            const head = player.segments[0];
            if (head && head.position) {
                // Draw a larger dot for the current player
                this.minimap.fillStyle(0x00ff00, 1);
                this.minimap.fillCircle(
                    head.position.x * scaleX,
                    head.position.y * scaleY,
                    4
                );
                
                // Draw a direction indicator
                const angleRad = player.angle * (Math.PI / 180);
                const dirX = head.position.x * scaleX + Math.cos(angleRad) * 8;
                const dirY = head.position.y * scaleY + Math.sin(angleRad) * 8;
                
                this.minimap.lineStyle(2, 0x00ff00, 1);
                this.minimap.beginPath();
                this.minimap.moveTo(head.position.x * scaleX, head.position.y * scaleY);
                this.minimap.lineTo(dirX, dirY);
                this.minimap.closePath();
                this.minimap.strokePath();
            }
        }
    }
    
    private handlePlayerDeath() {
        // Show death overlay
        this.deathOverlay.setVisible(true);
        
        // Show buttons
        this.respawnButton.setVisible(true);
        this.menuButton.setVisible(true);
        
        // Update score and rank on death screen
        const player = this.gameState.players.get(this.playerId);
        if (player) {
            const scoreText = this.deathOverlay.getByName('scoreText') as Phaser.GameObjects.Text;
            if (scoreText) {
                // Get player rank
                let playerRank = -1;
                const players: any[] = [];
                this.gameState.players.forEach((p: any) => {
                    if (p.score > 0) players.push(p);
                });
                
                const sortedPlayers = players.sort((a, b) => b.score - a.score);
                for (let i = 0; i < sortedPlayers.length; i++) {
                    if (sortedPlayers[i].id === this.playerId) {
                        playerRank = i + 1;
                        break;
                    }
                }
                
                // Show score and rank
                scoreText.setText(`Score: ${player.score}\nRank: ${playerRank > 0 ? playerRank : '-'}/${players.length}`);
            }
        }
        
        // Ensure buttons are interactive
        this.respawnButton.setInteractive({ useHandCursor: true });
        this.menuButton.setInteractive({ useHandCursor: true });
        
        // Play death sound
        this.deathSound.play();
        
        console.log('Death overlay shown');
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
                    const targetY = head.position.y - 40;
                    
                    // Calculate interpolated position
                    const newX = currentX + (targetX - currentX) * lerpFactor;
                    const newY = currentY + (targetY - currentY) * lerpFactor;
                    
                    // Update position
                    text.setPosition(newX, newY);
                    
                    // Scale text based on player score - similar to snake scaling
                    const baseScale = Math.min(1.5, 1 + (player.score / 100));
                    text.setScale(baseScale);
                }
            }
        });
    }
    
    private setupAudio() {
        // Set up sound effects
        this.eatSound = this.sound.add('eat');
        this.deathSound = this.sound.add('death');
        this.boostSound = this.sound.add('boost');
        
        // Set up background music with loop
        this.backgroundMusic = this.sound.add('background', {
            volume: 0.3,
            loop: true
        });
        
        // Start playing background music
        this.backgroundMusic.play();
    }
    
    private toggleMusic() {
        if (this.backgroundMusic.isPlaying) {
            this.backgroundMusic.pause();
        } else {
            this.backgroundMusic.resume();
        }
    }
    
    shutdown() {
        // Stop background music when leaving the scene
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
        }
        
        // Call the parent shutdown method instead of destroy
        super.shutdown();
    }
    
    // Add this new method to attract food in front of the snake
    private attractFoodInFront(headX: number, headY: number, angleDeg: number) {
        if (!this.gameState || !this.foods) return;
        
        const player = this.gameState.players.get(this.playerId);
        if (!player || !player.alive) return;
        
        // Convert angle to radians
        const angleRad = Phaser.Math.DegToRad(angleDeg);
        
        // Define the attraction parameters
        const attractionDistance = 200; // Tăng khoảng cách hút lên
        const attractionConeAngle = Math.PI / 2.5; // Mở rộng góc hút (khoảng 72 độ)
        const attractionStrength = 5; // Tăng lực hút lên đáng kể
        const eatDistance = 30; // Khoảng cách để tự động ăn thức ăn
        
        // Check each food item
        this.foods.forEach((foodSprite, foodId) => {
            // Calculate distance and angle to food
            const dx = foodSprite.x - headX;
            const dy = foodSprite.y - headY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Skip if too far away
            if (distance > attractionDistance) return;
            
            // Calculate angle to food
            const foodAngle = Math.atan2(dy, dx);
            
            // Calculate angle difference (accounting for wrapping)
            let angleDiff = Math.abs(foodAngle - angleRad);
            if (angleDiff > Math.PI) {
                angleDiff = 2 * Math.PI - angleDiff;
            }
            
            // Check if food is within the attraction cone
            if (angleDiff <= attractionConeAngle / 2) {
                // Calculate attraction force (stronger when closer and more aligned)
                const alignmentFactor = 1 - (angleDiff / (attractionConeAngle / 2));
                const distanceFactor = 1 - (distance / attractionDistance);
                const attractionForce = attractionStrength * alignmentFactor * distanceFactor;
                
                // Calculate movement vector toward the snake head
                const moveX = (headX - foodSprite.x) * attractionForce * 0.1; // Tăng hệ số lên gấp đôi
                const moveY = (headY - foodSprite.y) * attractionForce * 0.1; // Tăng hệ số lên gấp đôi
                
                // Apply movement (only visually on the client side)
                foodSprite.x += moveX;
                foodSprite.y += moveY;
                
                // Check if food is close enough to be eaten
                const newDistance = Phaser.Math.Distance.Between(headX, headY, foodSprite.x, foodSprite.y);
                if (newDistance < eatDistance) {
                    // Visually "eat" the food immediately
                    foodSprite.setVisible(false);
                    foodSprite.setScale(0);
                    
                    // Play eat sound
                    this.eatSound.play({ volume: 0.5 });
                    
                    // Add a visual effect at the position
                    this.addEatEffect(foodSprite.x, foodSprite.y);
                    
                    // Send message to server that food was eaten, including current positions
                    console.log(`Sending eatFood message for food ${foodId}, distance: ${newDistance}`);
                    this.room.send('eatFood', { 
                        foodId: foodId,
                        headX: headX,
                        headY: headY,
                        foodX: foodSprite.x,
                        foodY: foodSprite.y
                    });
                }
                
                // Add a subtle visual effect to show attraction
                if (!foodSprite.data || !foodSprite.data.get('isAttracting')) {
                    foodSprite.setData('isAttracting', true);
                    
                    // Add a more noticeable pulsing effect
                    this.tweens.add({
                        targets: foodSprite,
                        alpha: { from: 1, to: 0.7 },
                        scale: { from: 1, to: 1.5 }, // Tăng hiệu ứng phóng to
                        duration: 200, // Giảm thời gian để hiệu ứng nhanh hơn
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            } else {
                // Reset visual effect if food is no longer being attracted
                if (foodSprite.data && foodSprite.data.get('isAttracting')) {
                    foodSprite.setData('isAttracting', false);
                    
                    // Stop any existing tweens
                    this.tweens.killTweensOf(foodSprite);
                    
                    // Reset to normal appearance
                    foodSprite.setAlpha(1);
                    foodSprite.setScale(1);
                    
                    // Restart the normal scale animation
                    this.tweens.add({
                        targets: foodSprite,
                        scale: { from: 0.8, to: 1.2 },
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
        });
    }
    
    // Thêm phương thức mới để tạo hiệu ứng khi ăn thức ăn
    private addEatEffect(x: number, y: number) {
        // Tạo hiệu ứng particle khi ăn thức ăn
        const particles = this.add.particles(x, y, 'food', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 300,
            quantity: 5,
            blendMode: 'ADD'
        });
        
        // Tự động hủy sau khi hoàn thành
        this.time.delayedCall(300, () => {
            particles.destroy();
        });
    }
} 