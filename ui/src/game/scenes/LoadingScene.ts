import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class LoadingScene extends Scene {
    constructor() {
        super('LoadingScene');
    }

    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Loading text
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Progress bar background
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);
        
        // Register progress events
        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 + 10, 300 * value, 10);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            
            // Generate textures instead of loading images
            this.generateTextures();
            
            // Create dummy sound objects
            // this.createDummySounds();
            
            // Move to the menu scene
            this.scene.start('MenuScene');
        });

        // Load audio files
        this.load.audio('eat', 'sounds/eat.mp3');
        this.load.audio('death', 'sounds/death.wav');
        this.load.audio('boost', 'sounds/eat.mp3'); // Reusing eat sound for boost
        this.load.audio('background', 'sounds/background.mp3'); // Add background music
    }

    // private createDummySounds() {
    //     // Create dummy sound objects that do nothing when played
    //     const dummySound = {
    //         play: () => {},
    //         stop: () => {},
    //         pause: () => {},
    //         resume: () => {},
    //         destroy: () => {}
    //     };
        
    //     // Add these to the game's sound manager
    //     this.sound.sounds = this.sound.sounds || [];
        
    //     // Create a method to return our dummy sound
    //     const originalAdd = this.sound.add;
    //     this.sound.add = function(key: string) {
    //         return dummySound;
    //     };
        
    //     // Create references to our sounds
    //     this.sound.add('eat');
    //     this.sound.add('death');
    // }

    private generateTextures() {
        // Generate background texture
        this.generateBackgroundTexture();
        
        // Generate snake head texture
        this.generateSnakeHeadTexture();
        
        // Generate snake body texture
        this.generateSnakeBodyTexture();
        
        // Generate food textures
        this.generateFoodTexture();
        this.generateSpecialFoodTexture();
    }
    
    private generateBackgroundTexture() {
        // Create a graphics object for the background
        const bgGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Fill with a gradient
        bgGraphics.fillGradientStyle(0x0a2463, 0x0a2463, 0x3e92cc, 0x3e92cc, 1);
        bgGraphics.fillRect(0, 0, 256, 256);
        
        // Add some grid lines
        bgGraphics.lineStyle(1, 0xffffff, 0.1);
        for (let i = 0; i < 256; i += 32) {
            bgGraphics.moveTo(0, i);
            bgGraphics.lineTo(256, i);
            bgGraphics.moveTo(i, 0);
            bgGraphics.lineTo(i, 256);
        }
        
        // Generate texture
        bgGraphics.generateTexture('background', 256, 256);
        bgGraphics.destroy();
    }
    
    private generateSnakeHeadTexture() {
        // Create a graphics object for the snake head
        const headGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Draw a circle for the head
        headGraphics.fillStyle(0xffffff);
        headGraphics.fillCircle(16, 16, 16);
        
        // Add eyes
        headGraphics.fillStyle(0x000000);
        headGraphics.fillCircle(22, 10, 4);
        headGraphics.fillCircle(22, 22, 4);
        
        // Generate texture
        headGraphics.generateTexture('snake-head', 32, 32);
        headGraphics.destroy();
    }
    
    private generateSnakeBodyTexture() {
        // Create a graphics object for the snake body
        const bodyGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Draw a circle for the body segment
        bodyGraphics.fillStyle(0xffffff);
        bodyGraphics.fillCircle(12, 12, 12);
        
        // Generate texture
        bodyGraphics.generateTexture('snake-body', 24, 24);
        bodyGraphics.destroy();
    }
    
    private generateFoodTexture() {
        // Create a graphics object for the food
        const foodGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Draw a circle for the food
        foodGraphics.fillStyle(0xff0000);
        foodGraphics.fillCircle(8, 8, 8);
        
        // Generate texture
        foodGraphics.generateTexture('food', 16, 16);
        foodGraphics.destroy();
    }
    
    private generateSpecialFoodTexture() {
        // Create a graphics object for the special food
        const specialFoodGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Draw a star for the special food
        specialFoodGraphics.fillStyle(0xffff00);
        
        // Draw a star shape
        const centerX = 12;
        const centerY = 12;
        const points = 5;
        const outerRadius = 12;
        const innerRadius = 6;
        
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = Math.PI * 2 * (i / (points * 2)) - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            if (i === 0) {
                specialFoodGraphics.moveTo(x, y);
            } else {
                specialFoodGraphics.lineTo(x, y);
            }
        }
        
        specialFoodGraphics.closePath();
        specialFoodGraphics.fillPath();
        
        // Generate texture
        specialFoodGraphics.generateTexture('special-food', 24, 24);
        specialFoodGraphics.destroy();
    }

    create() {
        // Notify that the scene is ready
        EventBus.emit('current-scene-ready', this);
    }
} 