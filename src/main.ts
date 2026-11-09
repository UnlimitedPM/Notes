import './app.css';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';

registerSW({ immediate: true });

const target = document.getElementById('app');
if (!target) throw new Error('Élément #app introuvable');

const app = mount(App, { target });

export default app;
