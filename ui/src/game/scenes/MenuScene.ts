import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GAME_INFO } from '../../configs/game';

export class MenuScene extends Scene {
    private playerName: string = 'Player';
    private selectedSkin: number = 0;
    private skins: number[] = [0, 1, 2, 3]; // Skin IDs
    private skinImages: Phaser.GameObjects.Image[] = [];
    
    constructor() {
        super('MenuScene');
    }
    
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Add background
        const bg = this.add.image(width / 2, height / 2, 'background');
        const scaleX = width / bg.width;
        const scaleY = height / bg.height;
        const scale = Math.max(scaleX, scaleY);
        bg.setScale(scale).setScrollFactor(0);
        
        // Add title
        this.add.text(width / 2, height / 4, GAME_INFO.name, {
            fontFamily: 'Arial',
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Add subtitle
        this.add.text(width / 2, height / 4 + 70, 'Multiplayer Snake Game', {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Name input
        this.add.text(width / 2, height / 2 - 50, 'Your Name:', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Create a DOM element for name input
        const nameInput = this.add.dom(width / 2, height / 2).createFromHTML(`
            <input type="text" id="nameInput" maxlength="15" placeholder="Enter your name" 
                   style="padding: 10px; width: 200px; text-align: center; border-radius: 5px; border: none;">
        `);
        
        // Set default value
        setTimeout(() => {
            const inputElement = document.getElementById('nameInput') as HTMLInputElement;
            if (inputElement) {
                inputElement.value = this.playerName;
                inputElement.addEventListener('input', (e) => {
                    this.playerName = (e.target as HTMLInputElement).value;
                });
            }
        }, 100);
        
        // Skin selection
        this.add.text(width / 2, height / 2 + 50, 'Choose Your Skin:', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Add skin selection
        this.createSkinSelection(width / 2, height / 2 + 120);
        
        // Play button
        const playButton = this.add.text(width / 2, height * 3/4, 'PLAY', {
            fontFamily: 'Arial',
            fontSize: '36px',
            color: '#ffffff',
            backgroundColor: '#4CAF50',
            padding: {
                left: 30,
                right: 30,
                top: 10,
                bottom: 10
            }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        // Button effects
        playButton.on('pointerover', () => {
            playButton.setScale(1.1);
        });
        
        playButton.on('pointerout', () => {
            playButton.setScale(1);
        });
        
        playButton.on('pointerdown', () => {
            // Get the final name from input
            const inputElement = document.getElementById('nameInput') as HTMLInputElement;
            if (inputElement) {
                this.playerName = inputElement.value || 'Player';
            }
            
            // Start the game
            this.scene.start('GameScene', { 
                playerName: this.playerName,
                skinId: this.selectedSkin
            });
        });
        
        // Instructions
        this.add.text(width / 2, height - 50, 'Use mouse to control direction. Eat food to grow. Avoid other snakes!', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Notify that the scene is ready
        EventBus.emit('current-scene-ready', this);
    }
    
    private createSkinSelection(x: number, y: number) {
        const spacing = 80;
        
        // Create skin selection boxes
        for (let i = 0; i < this.skins.length; i++) {
            const skinX = x + (i - (this.skins.length - 1) / 2) * spacing;
            
            // Create a container for the skin
            const container = this.add.container(skinX, y);
            
            // Background for the skin
            const bg = this.add.rectangle(0, 0, 60, 60, 0x333333, 0.7)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            container.add(bg);
            
            // Add snake head image (placeholder - you'll need actual skin images)
            const skinImage = this.add.image(0, 0, 'snake-head')
                .setTint(this.getSkinColor(this.skins[i]));
            container.add(skinImage);
            this.skinImages.push(skinImage);
            
            // Selection indicator
            const selectionIndicator = this.add.rectangle(0, 0, 70, 70, 0xffff00, 0)
                .setStrokeStyle(3, 0xffff00);
            container.add(selectionIndicator);
            
            // Show selection for default skin
            if (i === this.selectedSkin) {
                selectionIndicator.setStrokeStyle(3, 0xffff00);
            } else {
                selectionIndicator.setStrokeStyle(3, 0xffff00, 0);
            }
            
            // Handle click
            bg.on('pointerdown', () => {
                this.selectedSkin = i;
                
                // Update all selection indicators
                for (let j = 0; j < this.skins.length; j++) {
                    const indicator = this.children.getByName(`selection_${j}`) as Phaser.GameObjects.Rectangle;
                    if (j === i) {
                        selectionIndicator.setStrokeStyle(3, 0xffff00, 1);
                    } else {
                        const otherIndicator = this.children.getByName(`selection_${j}`) as Phaser.GameObjects.Rectangle;
                        if (otherIndicator) {
                            otherIndicator.setStrokeStyle(3, 0xffff00, 0);
                        }
                    }
                }
            });
            
            // Name the selection indicator for easy access
            selectionIndicator.setName(`selection_${i}`);
        }
    }
    
    private getSkinColor(skinId: number): number {
        // Return different colors based on skin ID
        const colors = [0xFF5733, 0x33FF57, 0x3357FF, 0xF3FF33];
        return colors[skinId % colors.length];
    }
} 