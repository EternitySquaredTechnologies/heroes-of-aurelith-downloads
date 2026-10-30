'use strict';
// Runs in a worker so a hidden tab cannot slow it down. web-bridge.js turns each tick into a ping.
setInterval(() => postMessage(0), 15000);
