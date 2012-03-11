var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
dgram = require('dgram'),
riak = require('riak-js'),
crypto = require('crypto'),
util = require('util'),
amqp = require('amqp'),
datefmt = require("./datefmt");


var rulebase = [
/(Deny)\s(udp)\ssrc\s\S+:(\S+)\/\S+\sdst\s\S+:(\S+)\/.*/,
/(Built)\sinbound\s(TCP).*for\s\S+:(\S+)\/\S+.*to\s\S+:(\S+)\/.*/,
/(Built)\sinbound\s(UDP).*for\s\S+:(\S+)\/\S+.*to\s\S+:(\S+)\/.*/,
/(Teardown)\s(UDP).*for\s\S+:(\S+)\/\S+\sto\s\S+:(\S+)\/.*/,
/(Teardown)\s(TCP).*for\s\S+:(\S+)\/\S+\sto\s\S+:(\S+)\/.*/,
/(Deny)\s(TCP).*from\s(\S+)\/\S+\sto\s(\S+)\/.*/,
/(Packet dropped).*action=\"(\S+)\".*srcip=\"(\S+)\".*dstip=\"(\S+)\".*/
];
var db = riak.getClient(config)

var srv = {
	server: null,
	conn: null,
	exchange: null,
	queue: null
}

var packetsReceived = [0,0,0,0];
var packetsStored = [0,0,0,0];
var diskUsage = [0,0];


function setup() {

  console.log("running setup.. ");
  var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {
    srv.exchange = exchange
    var working_queue = conn.queue(amqp_config.cep_queue, { durable: false, exclusive: false },
    function() {
    	working_queue.subscribe(function(msg) { processMessage(msg); });
    });

    set_stats(exchange); 
  }); 
}


function set_stats(exchange) {

	setInterval(function() {
	    var stats = { packetsReceived: packetsReceived, packetsStored: packetsStored, overhead: packetsReceived - packetsStored, time: datefmt.getDateInt() };
            exchange.publish('cepworker', stats);
	    console.log("Worker " + process.pid.toString() + " PacketsReceived: " + packetsReceived.toString()  + " PacketsStored: " + packetsStored.toString());
            packetsReceived = [0,0,0,0];
            packetsStored = [0,0,0,0];
        }, 10  * 1000); // every 20 sec
	

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
    for (i = 0; i< rulebase.length; i++) {
	rez = msg.body.message.match(rulebase[i]);
	if (rez) {
	  updateData(rez[1],rez[3],rez[4], msg.body.origin);
	}

    }


    
    if (msg.body.severity < 4) {
	packetsStored[1]++;
	packetsReceived[1]++;
    } else if (msg.body.severity == 5 || msg.body.severity == 6 ) {
	packetsStored[2]++;
	packetsReceived[2]++;
    } else {
	packetsStored[3]++;
	packetsReceived[3]++;
    }

}


function updateData(bucket, src, dst,origin) {
	if (bucket == "Packet dropped") {
		bucket = "Deny";
	}
	db.get(bucket,origin + ":" + src + ":" + dst, function(err, val, meta) {
		if (!meta) { return };
		key = meta.key;
		d = key.match(/(.*):(.*):(.*)/);
		if (err) {
			if (err.code != "ECONNRESET") {
				saveDBData(meta.bucket, key, d[1], d[2], d[3], {count: 1, origin:d[1], src:d[2], dst:d[3]});
			}
		} else {
		    val.count = val.count + 1;
	  	    saveDBData(meta.bucket, key,d[1], d[2], d[3], val);
		}

	});
}


function saveDBData(bucket, key, origin, src, dst, val) {

	db.save(bucket, key, val,
		{headers: {
		"X-Riak-index-origin_bin":origin,
		"X-Riak-index-src_bin":src,
		"X-Riak-index-dst_bin":dst
		}}
	);
}

