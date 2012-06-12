var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
dgram = require('dgram'),
riak = require('riak-js'),
crypto = require('crypto'),
util = require('util'),
amqp = require('amqp'),
querystring = require('querystring'),
datefmt = require("./datefmt"),
curl = require('curl');


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
    var m = {};
    if (msg.body.hasOwnProperty('src')) {
	    m.date = msg.body.date;
	    m.origin = msg.body.origin;
	    m.src = msg.body.src;
            m.src_port = msg.body.src_port;
            m.dst_port  = msg.body.dst_port;
            m.action = msg.body.action;
	    m.dst = msg.body.dst;
	    m.message = msg.body.message;
	    m.severity = msg.body.severityID;
	    m.facilityID = msg.body.facilityID;
	    m.time = msg.body.time;
	    
	    var s = querystring.stringify(m);
	    var cep = "http://localhost:8084/sendevent?stream=SyslogEvent&" + s;
	    //console.log(cep);
            console.log(JSON.stringify(msg.body));
	    curl.get(cep, {}, function(err, response, body) { return 0;}); 
	    //console.log(s);
   }

}

