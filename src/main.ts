import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { startUpdates } from './lib/update';
import { requestPersistence } from './lib/storage';
import { applyTheme } from './lib/settings.svelte';

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

mount(App, { target: document.getElementById('app')! });

// Precache everything so the games keep working with no signal at the party.
if (import.meta.env.PROD) startUpdates();
void requestPersistence();
