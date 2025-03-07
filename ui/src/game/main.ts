import { AUTO, Game, Scale } from 'phaser';
import { GAME_INFO } from '../configs/game';
import { LoadingScene } from './scenes/LoadingScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: window.innerWidth*window.devicePixelRatio,
        height: window.innerHeight*window.devicePixelRatio
    },
    title: GAME_INFO.name,
    scene: [
        LoadingScene,
        MenuScene,
        GameScene
    ],
    // Enhanced graphics settings
    pixelArt: false, // Set to true for pixel art games
    roundPixels: false, // Prevents pixel interpolation for pixel art
    antialias: true, // Enables anti-aliasing for smoother graphics
    antialiasGL: true, // WebGL specific anti-aliasing
    desynchronized: true, // Reduces input lag
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            fps: 60
        }
    },
    dom: {
        createContainer: true
    },
    render: {
        transparent: false,
        clearBeforeRender: true,
        powerPreference: 'high-performance'
    },
    fps: {
        target: 60,  // Target 120 FPS
        forceSetTimeOut: false
    }
};

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });
    // Set canvas resolution after game creation
    // game.canvas.style.width = '100%';
    // game.canvas.style.height = '100%';
    return game;
}

export { StartGame };
