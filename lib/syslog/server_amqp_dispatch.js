var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
Iconv   = require('iconv').Iconv,
dgram = require('dgram'),
os = require('os'),
riak = require('riak-js'),
amqp = require('amqp');

var iconv = new Iconv("big5", "UTF-8");

var db = riak.getClient(config);
var classifications  = {};

var packets = 0;
var srv = {
	server: null,
	conn: null,
	exchange: null,
	livetail: null,
	livetailq: null,
	queue: null
}

function setup() {

    var livetailq = conn.queue('livetailq', { durable: false, exclusive: false, 'x-message-ttl': 6000 },
	function () {
		srv.livetailq = livetailq;
    		var exchange2 = conn.exchange('livetail', {'type': 'fanout', durable: false}, function() {
			srv.livetail = exchange2;
			//srv.livetailq.bind(exchange2);
		});
	});

    var queue = conn.queue(amqp_config.work_queue, {durable: false, exclusive: false, "x-message-ttl": 1000 * 60},
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
	try {
		handleSyslogMessage(iconv.convert(rawMessage), rinfo)
	} catch (err) {
		console.log("Caught exception: " + err + " while processing <<" + rawMessage + ">>");
	}
    });
    
    
    server.on("listening", function(){
	var address = server.address()
  	console.log("Syslog server listening at " + address.address + ":" + address.port)
    });
	
    server.on("close", function(){
 	console.log("Syslog server shutting down.")
    });
    setInterval(printStatus, 10000);
    setInterval(fetchClassification, 10000);
	
    var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {
	//srv.queue.bind(exchange);
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
	parsedMessage.message = clearNulls(parsedMessage.message);
	parsedMessage.originalMessage = clearNulls(parsedMessage.originalMessage);
	if (parsedMessage.severityID) {
	    parsedMessage.severity = parsedMessage.severityID;
	} else {
	    parsedMessage.severity = -1;
	}	
	parsedMessage.date = getDateInt()
        parsedMessage = updateFields(parsedMessage);
	
        if (doCEPMessage(parsedMessage)) {
	    passMessageCEP(parsedMessage);
        }
        passMessageStore(parsedMessage);
	passMessageLiveTail(parsedMessage);

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

function passMessageLiveTail(parsedMessage) {
	srv.livetail.publish(parsedMessage.origin, { body: parsedMessage });
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

// some loggers include ending 0s. so we need to clean'em up
function clearNulls(buf) {
       buf = buf.replace(/\0/g, '');
       return buf;
}


function updateFields(parsedMessage) {

var rulebase = [
/(Deny)\s(udp)\ssrc\s\S+:(\S+)\/\S+\sdst\s\S+:(\S+)\/.*/,
/(Built)\sinbound\s(TCP).*for\s\S+:(\S+)\/\S+.*to\s\S+:(\S+)\/.*/,
/(Built)\sinbound\s(UDP).*for\s\S+:(\S+)\/\S+.*to\s\S+:(\S+)\/.*/,
/(Teardown)\s(UDP).*for\s\S+:(\S+)\/\S+\sto\s\S+:(\S+)\/.*/,
/(Teardown)\s(TCP).*for\s\S+:(\S+)\/\S+\sto\s\S+:(\S+)\/.*/,
/(Deny)\s(TCP).*from\s(\S+)\/\S+\sto\s(\S+)\/.*/,
/(Packet dropped).*action=\"(\S+)\".*srcip=\"(\S+)\".*dstip=\"(\S+)\".*/,
/CST,([^,]+),.*src=([^,]+),.*dst=([^,]+).*/
];


       if (parsedMessage.message.match(/Attack/)) {
            parsedMessage.alert = true
             parsedMessage.classify = ["Attack"]
            parsedMessage.status = "new"
       }


    for (i = 0; i< rulebase.length; i++) {
	rez = parsedMessage.message.match(rulebase[i]);
	if (rez) {
              if (parsedMessage.classify) {
	      	parsedMessage.classify.push(rez[1]);
	      } else {
		parsedMessage.classify = [ rez[1]];
	      }
	      parsedMessage.src = rez[3];
	      parsedMessage.dst = rez[4];
	}
    }
    
    for (key in classifications) {
	if (parsedMessage.message.indexOf(classifications[key]['class_match_str']) != -1) {
	    if (classifications[key]['class_enable'] == true) {
		    parsedMessage.alert = true;
	    }
            parsedMessage.severityID = parseInt(classifications[key]['class_severity']);
            parsedMessage.priority = parseInt(classifications[key]['class_priority']);
            console.log(parsedMessage.severityID);

            if (!parsedMessage.severityID) {
                      parsedMessage.severityID = 0;
            }
            if (!parsedMessage.priority) {
                      parsedMessage.priority = 0;
            }
	    if (parsedMessage.classify) {
		parsedMessage.classify.push(classifications[key]['class_name']);
	    } else {
		parsedMessage.classify  = [ classifications[key]['class_name']];
	    }	
	}
   }

return parsedMessage;
}


function fetchClassification() {
    db.keys('classification', {keys: 'stream'}).on('keys', function(k) {
    if (k.length > 0) {
	for (var i = 0; i < k.length; i++) {
		db.get('classification', k[i], function(err, val, meta) {
		   if (!err) {
			   v = JSON.parse(val);
			   classifications[v['class_uuid']] = v;
                       }
                });
        }
    }

 }).start();

}


process.on('uncaughtException', function(err) {
  console.log("Uncaught Error " + err);
});


