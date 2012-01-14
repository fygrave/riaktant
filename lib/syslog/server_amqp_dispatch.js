var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
dgram = require('dgram'),
os = require('os'),
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
    var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {
	setInterval(function() {
	    // send stats
	    exchange.publish('source', {packets: packets, source: getSourceID(), load: os.loadavg(), memory: os.freemem(), type: 'syslog', timestamp: getDateInt()});
	    packets = 0;	    
	}, 10000);
    });
    
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
function getSourceID() {
    // javascript get host by name?
    
    return os.hostname();
}
function handleSyslogMessage(rawMessage, rinfo) {
    syslogParser.parse(rawMessage, function(parsedMessage) {
	parsedMessage.origin = rinfo.address 
	parsedMessage.class = "syslog"
	parsedMessage.severity = 0
	parsedMessage.sensor = getSourceID()
	parsedMessage.date = getDateInt()
	if (parsedMessage.severityID) {
	    parsedMessage.severity = parsedMessage.severityID;
	}	
	parsedMessage.date = getDateInt()
	
	conn.publish(amqp_config.work_queue,{
	    body: parsedMessage  
	}
		    );
    });
}
    


// refactor getDateInt into utils.. or something
var padInteger = function(number) {
    return (number < 10 ? '0' : '') + number.toString()    
}



var getDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes()) + padInteger(d.getSeconds())
    return parseInt(dateline)

}
