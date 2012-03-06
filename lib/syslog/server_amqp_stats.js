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
var last = [0,0,0,0];
var last5min = [0,0,0,0];

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
  setInterval(update5minStatistics, 5 * 1000); // every 5 min



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
            if (err.code != "ECONNRESET") { 
	        console.log("reFresh statistics");
	        var stats = {packetsReceived: packetsReceived[0], lastupdate: timestamp };
	        db.save('statistics', totalKey, stats);
	    }
	} else {
	    packs.packetsReceived = packs.packetsReceived + (packetsReceived[0] - last[0]);
	    packs.lastupdate = timestamp;
	    db.save('statistics', totalKey, packs)
	}
	last = packetsReceived;
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
   var datest = getDateInt();
   
   updateTimeStatistics(Math.floor(datest/ 100 - (datest/100) %5), "stat5min", last5min)
   updateTimeStatistics(Math.floor(datest/ 10000), "statHour", last5min)
   updateTimeStatistics(Math.floor(datest/ 1000000), "statDay", last5min)
   updateTimeStatistics(Math.floor(datest/ 100000000), "statYear", last5min)
   var datestr = Math.floor(datest / 100 - (timestamp /100) % 5 )
   console.log("save " + datestr.toString() + "count: " + (packetsReceived[0] - last5min[0]).toString());
   last5min = packetsReceived;
}

function updateTimeStatistics(datest, bucket, lastv) {
   
   console.log("updateTimeStat: " + datest + " " + JSON.stringify(lastv));
   db.get(bucket, datest, function(err, stat, meta) {
      if (err) {
         console.log("new val: " + datest + " b: " + bucket);
         db.save(bucket, datest, { count: sub_array(packetsReceived, lastv)},
	    {headers:{ "X-Riak-index-date_int": datest }}
	  );
      } else {
         console.log("up val: " + datest + " b: " + bucket + " stat " + JSON.stringify(stat));
          db.save(bucket, datest, { count: add_array(stat.count, sub_array(packetsReceived, lastv)) },
	    {headers:{ "X-Riak-index-date_int": datest }}
	  );
    }
  });
}


function update_source(msg) {

    console.log(msg.timestamp + " " + msg.source + " " + msg.type + " upd pkts: " +  msg.packets + " load: " +msg.load)
    db.get('sources', msg.source + "_" + msg.type, function(err, packs, meta) {
        if (err) {
            db.save('sources', msg.source + "_" + msg.type, msg);
        } else {
            packs.source = msg.source
	    packs.packets = msg.packets + packs.packets
	    if (packs.packets == undefined) {
	        packs.packets = 0;
	    }
	    packs.type = msg.type
	    packs.load = msg.load
	    packs.free_memory = msg.free_memory
	    packs.total_memory = msg.total_memory
	    packs.os_type = msg.os_type
	    packs.cpus = msg.cpus
	    packs.uptime = msg.uptime
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

// refactor getDateInt into utils.. or something
var padInteger = function(number) {
    return (number < 10 ? '0' : '') + number.toString()    
}



var getDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes()) + padInteger(d.getSeconds())
    return parseInt(dateline)

}
