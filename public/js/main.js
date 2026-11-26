/**
 * Entry point for the customer page (index.html).
 * Imports each feature module and starts it.
 */

import { initTableNumber, initCartEvents } from './cart.js';
import { initMenuEvents } from './menu.js';
import { initCheckoutEvents } from './checkout.js';
import { initTrackingEvents } from './tracking.js';

initTableNumber();
initCartEvents();
initMenuEvents();
initCheckoutEvents();
initTrackingEvents();
