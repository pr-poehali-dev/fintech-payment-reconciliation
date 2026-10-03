import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installSessionFetch } from './lib/session'

installSessionFetch();

createRoot(document.getElementById("root")!).render(<App />);