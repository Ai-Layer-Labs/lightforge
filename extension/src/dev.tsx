import React from 'react';
import ReactDOM from 'react-dom/client';
import { Chat } from './popup/Chat';
import './popup/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Chat />
  </React.StrictMode>
);
