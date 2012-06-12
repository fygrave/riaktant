var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
dgram = require('dgram'),
riak = require('riak-js'),
crypto = require('crypto'),
util = require('util'),
amqp = require('amqp'),
datefmt = require("./datefmt");


var db = riak.getClient(config)

var srv = {
	server: null,
	conn: null,
	exchange: null,
	queue: null
}



function setup() {

  console.log("running setup.. ");
  var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {
    srv.exchange = exchange
    var working_queue = conn.queue(amqp_config.cep_queue, { durable: false, exclusive: false },
    function() {
    	working_queue.subscribe(function(msg) { processMessage(msg); });
    });

  }); 
}



console.log("Starting worker AMQP URL: " + amqp_config.url);
var conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

module.exports = srv
//-----------------------------------------------------------
// --- helpers ---
//-----------------------------------------------------------

function processMessage(msg) {
// TODO: total stats are to be updated
// TODO: filtering
//  console.log(msg)
//console.log("got message " + msg.body + "from " +  msg.rinfo.address)
    packetsReceived[0]++;
    s = querystring.stringify(msg.body);
    console.log(s);

}

