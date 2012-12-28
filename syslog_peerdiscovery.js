// will need  https://github.com/bpot/node-gossip.git
var Gossiper = require('gossiper').Gossiper;
// Create a seed peer.
var seed = new Gossiper(9000, []);
seed.start();

setInverval(function() {
    console.log("peers " +  console.log(seed.allPeers());
}, 15000);
