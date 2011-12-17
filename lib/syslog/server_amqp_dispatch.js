var config = require("../../config/config.js"),
    amqp_config = require("../../config/amqp.js"),
    dgram = require('dgram'),
    amqp = require('amqp');

var packets = 0;
var srv = {
	server: null,
	conn: null,
	exchange: null,
	queue: null
}


function setup() {

    var queue = conn.queue(amqp_config.work_queue, {durable: false, exclusive: false},
    function() {
    srv.queue = queue;
    syslog_server(); });
}

function printStatus() {
	console.log("Syslog received packets: " + packets.toString())
}

function syslog_server() {

	var server = dgram.createSocket("udp4")
	server.on("message", function(rawMessage, rinfo) {
		packets++;
		handleSyslogMessage(rawMessage, rinfo)
	});

	
	server.on("listening", function(){
		var address = server.address()
  		console.log("Syslog server listening at " + address.address + ":" + address.port)
	});
	
	server.on("close", function(){
 		console.log("Syslog server shutting down.")
	});
	setInterval(printStatus, 10000);
	server.bind(config.syslog_port)
        srv.server = server
}


console.log("Starting syslog server AMQP URL: " + amqp_config.url);
var conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

module.exports = srv
//-----------------------------------------------------------
// --- helpers ---
//-----------------------------------------------------------
function handleSyslogMessage(rawMessage, rinfo) {
	conn.publish(amqp_config.work_queue,{body: rawMessage.toString('utf8', 0), rinfo: rinfo});

}

