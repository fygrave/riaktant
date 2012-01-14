var config = require("../../config/config.js"),
    amqp_config = require("../../config/amqp.js"),
    syslogParser = require('glossy').Parse,
    dgram = require('dgram'),
    riak = require('riak-js'),
    crypto = require('crypto'),
    amqp = require('amqp');


var db = riak.getClient(config)

var packetsReceived = [0,0,0,0];
var timestamp = 0;
var overhead = 0;
var last = 0;
var last5min = [0,0,0,0];
var lastHour = [0,0,0,0];
var lastDay = [0,0,0,0];
var lastMonth = [0,0,0,0];

function setup() {

  var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {

      var worker_queue = conn.queue('worker', {durable: false, exclusive: true},
			     function() {
				 worker_queue.subscribe(function(msg, headers, deliveryInfo) {
				  
					 update_stats(msg);
				     
				 });
				 worker_queue.bind(exchange.name, 'worker');
			     });
      var source_queue = conn.queue('source', { durable: false, exclusive: true},
				    function() {
					source_queue.subscribe(function(msg, headers, deliveryInfo) {
					   
						update_source(msg);
					   
					});
					source_queue.bind(exchange.name, 'source');
				    });
  });
  setInterval(updateTotalStatistics, 10  * 1000); // every 20 sec
  setInterval(update5minStatistics, 5 * 60 * 1000); // every 5 min
  setInterval(updateHourStatistics, 60 * 60 * 1000); // every hour
  setInterval(updateDayStatistics, 24 * 60 * 60 * 1000); // every day
  setInterval(updateMonthStatistics,  30 * 24 * 60 * 60 * 1000); // every month



}


var conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

//-----------------------------
//-- helpers 
//----------------------------

function updateTotalStatistics() {
    var totalKey = 'total_packets';
    db.get('statistics', totalKey, function(err, packs, meta) {
	if (err) {
	    var stats = {packetsReceived: packetsReceived[0], lastupdate: timestamp };
	    db.save('statistics', totalKey, stats);
	} else {
	    packs.packetsReceived = packs.packetsReceived + (packetsReceived[0] - last);
	    packs.lastupdate = timestamp;
	    db.save('statistics', totalKey, packs)
	}
	last = packetsReceived[0];
    });

}

function update_stats(msg) {
    console.log(msg)
    packetsReceived = add_array(packetsReceived, msg.packetsReceived);
    overhead = overhead + msg.overhead
    timestamp = msg.time
    console.log(timestamp + "upd pkts: " +  packetsReceived + " -> " + msg.packetsReceived + ", " + overhead)
}

function update5minStatistics() {
    var datest = Math.floor(timestamp / 100 - (timestamp /100) % 5 )
    console.log("save " + datest.toString() + "count: " + (packetsReceived[0] - last5min[0]).toString());
    db.save('stat5min', datest, {count: sub_array(packetsReceived, last5min)},
	    {headers:{ "X-Riak-index-date_int": datest }}
	   );
	last5min = packetsReceived;
}

function updateHourStatistics() {
    var datest = Math.floor(timestamp / 10000)
    db.save('statHour', datest, {count: sub_array(packetsReceived, lastHour)},
	    {headers:{ "X-Riak-index-date_int": datest }}
	   );
    lastHour = packetsReceived;
}

function updateDayStatistics() {
    var datest = Math.floor(timestamp / 1000000)
    db.save('statDay', datest, {count: sub_array(packetsReceived, lastDay)},
	    {headers:{ "X-Riak-index-date_int": datest }}
	   );
    lastDay = packetsReceived;
}

function updateMonthStatistics() {
	var datest = Math.floor(timestamp / 100000000)
    db.save('statMonth', datest, {count: sub_array(packetsReceived, lastMonth)},
			{headers:{ "X-Riak-index-date_int": datest }}
);
	lastMonth = packetsReceived;
}

function update_source(msg) {

    console.log(msg.timestamp + " " + msg.source + " " + msg.type + " upd pkts: " +  msg.packets + " load: " +msg.load)
    db.get('sources', msg.source + "_" + msg.type, function(err, packs, meta) {
        if (err) {
            db.save('sources', msg.source + "_" + msg.type, msg);
        } else {
            packs.source = msg.source
	    packs.type = msg.type
	    packs.load = msg.load
	    packs.memory = msg.memory
	    packs.timestamp = msg.timestamp
            db.save('sources', msg.source + "_" + msg.type, packs)
        }
    });

}

function add_array(a, b) {
    c = [0,0,0,0];
    for (i = 0; i<  4; i++) { c[i] = a[i] + b[i]; }
    return c;

}

function sub_array(a, b) {
    c = [0,0,0,0];
    for (i = 0; i<  4; i++) { c[i] = a[i] - b[i]; }
    return c;

}