import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { GAME_INFO } from './configs/game';

// Set document title
document.title = GAME_INFO.name;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
