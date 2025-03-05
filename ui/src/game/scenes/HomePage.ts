import { GameObjects, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GAME_INFO } from '../../configs/game';

export class HomePage extends Scene
{
    background: GameObjects.Image;
    welcomeText: GameObjects.Text;
    titleText: GameObjects.Text;
    subText: GameObjects.Text;

    constructor ()
    {
        super('HomePage');
    }

    preload ()
    {
        // Load assets
        this.load.setPath('images');
        this.load.image('background', 'bg.png');
        this.load.image('star', 'star.png');
    }

    create ()
    {
        // Get the center coordinates of the game
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Add background and scale it to cover the screen
        this.background = this.add.image(centerX, centerY, 'background');
        this.scaleBackgroundToFill();

        // Add welcome text
        this.welcomeText = this.add.text(centerX, centerY - 200, 'Welcome to', {
            fontFamily: 'Arial', 
            fontSize: 48, 
            color: '#ffffff',
            stroke: '#000000', 
            strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        // Add title text
        this.titleText = this.add.text(centerX, centerY - 100, GAME_INFO.name, {
            fontFamily: 'Arial Black', 
            fontSize: 72, 
            color: '#ffffff',
            stroke: '#000000', 
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        // Add sub text
        this.subText = this.add.text(centerX, centerY, GAME_INFO.description, {
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#ffffff',
            stroke: '#000000', 
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        // Add animation to the title
        this.tweens.add({
            targets: this.titleText,
            y: { value: centerY - 80, duration: 1500, ease: 'Sine.easeInOut' },
            scale: { value: 1.1, duration: 1500, ease: 'Sine.easeInOut' },
            yoyo: true,
            repeat: -1
        });

        // Add random stars in the background
        this.addRandomStars(20);

        // Listen for resize events
        this.scale.on('resize', this.resize, this);

        // Notify that the scene is ready
        EventBus.emit('current-scene-ready', this);
    }

    resize(gameSize: Phaser.Structs.Size): void {
        // Update the center coordinates
        const centerX = gameSize.width / 2;
        const centerY = gameSize.height / 2;

        // Reposition elements
        this.background.setPosition(centerX, centerY);
        this.scaleBackgroundToFill();
        
        this.titleText.setPosition(centerX, centerY - 100);
        this.welcomeText.setPosition(centerX, centerY - 200);
        this.subText.setPosition(centerX, centerY);
    }

    scaleBackgroundToFill(): void {
        // Scale the background to cover the entire screen
        const scaleX = this.cameras.main.width / this.background.width;
        const scaleY = this.cameras.main.height / this.background.height;
        const scale = Math.max(scaleX, scaleY);
        this.background.setScale(scale);
    }

    addRandomStars(count: number): void {
        for (let i = 0; i < count; i++) {
            const x = Phaser.Math.Between(0, this.cameras.main.width);
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            
            const star = this.add.image(x, y, 'star').setScale(0.5);
            
            this.tweens.add({
                targets: star,
                alpha: { from: 0.2, to: 1 },
                scale: { from: 0.3, to: 0.5 },
                duration: 1000 + Math.random() * 2000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: Math.random() * 1000
            });
        }
    }
} 