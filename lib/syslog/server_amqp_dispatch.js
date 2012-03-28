var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
Iconv   = require('iconv').Iconv,
dgram = require('dgram'),
os = require('os'),
amqp = require('amqp');

var iconv = new Iconv("big5", "UTF-8");

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
	handleSyslogMessage(iconv.convert(rawMessage), rinfo)
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
	    exchange.publish('source', {packets: packets, source: getSourceID(), load: os.loadavg(), total_memory: os.totalmem(), os_type: os.type(), uptime: os.uptime(), cpus: os.cpus(), free_memory: os.freemem(), type: 'syslog', timestamp: getDateInt()});
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

  try {
      syslogParser.parse(rawMessage, function(parsedMessage) {
	parsedMessage.origin = rinfo.address 
	parsedMessage.class = "syslog"
	parsedMessage.severity = 0
	parsedMessage.sensor = getSourceID()
	parsedMessage.date = getDateInt()
	if (parsedMessage.severityID) {
	    parsedMessage.severity = parsedMessage.severityID;
	} else {
	    parsedMessage.severity = -1;
	}	
	parsedMessage.date = getDateInt()
	
        if (doCEPMessage(parsedMessage)) {
	    passMessageCEP(parsedMessage);
        }
        passMessageStore(parsedMessage);

     }); // parse
    } catch(err) {
	console.log("Error: " + err + " while parsing " + rawMessage.toString('utf8'));
	parsedMessage = { 
	    originalMessage: rawMessage.toString('utf8'),
	    origin: rinfo.address,
	    class: "bad"
	};
        passMessageCEP(parsedMessage);
    }

}

function passMessageCEP(parsedMessage) {
	conn.publish(amqp_config.cep_queue,{
	    body: parsedMessage  
	}
   );
}
 


function passMessageStore(parsedMessage) {
	conn.publish(amqp_config.work_queue,{
	    body: parsedMessage  
	}
   );
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

//
// This really should be some sort of database. later
//
function doCEPMessage(parsedMessage) {
       
       if (parsedMessage.message.match(/Built/)) return true;
       if (parsedMessage.message.match(/Teardown/)) return true;
       if (parsedMessage.message.match(/Packet dropped/)) return true;
       if (parsedMessage.message.match(/Deny/)) return true;

       return false;
}


