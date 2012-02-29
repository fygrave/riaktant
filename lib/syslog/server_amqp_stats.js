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
  setInterval(updateSystem, 10 * 1000); // every 5 min



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

function updateSystem() {
	console.log("update System");
	db.stats({}, function(err, arg, meta) {
	var data = {}
	var members = arg.ring_members;
	for(var i=0; i<members.length; i++) {
	    db.get('system', members[i], function(err, pack, meta) {
		//data.disk = arg.disk[0][2];
		data.cpu_nprocs = arg.cpu_nprocs;
		data.cpu_avg1 = arg.cpu_avg1;
		data.cpu_avg5 = arg.cpu_avg5;
		data.cpu_avg15 = arg.cpu_avg15;
		data.status = "valid";
		data.reachable = true;
		data.mem_total = arg.mem_total;
		data.mem_used = arg.mem_allocated;
		data.mem_erlang = arg.memory_total;
		fixed_ring = arg.ring_ownership.replace(/{/gi,"[").replace(/}/gi,"]").replace(/'/gi,"\"");
		ring = JSON.parse(fixed_ring);
		for (var j=0; j < ring.length; j++){
			r = ring[j]
			
			if (r[0] == meta.key) {
				console.log(r[0]);
				data.ring_pct = r[1]
				data.pending_pct = r[1] // TODO: wrong!
			}
		}
		

		console.log( "saving " + meta.key + " meta " + JSON.stringify(meta));
		db.save('system', meta.key, data);
		}); 
	}
	

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
   updateTimeStatistics(Math.floor(timestamp/ 100 - (timestamp/100) %5), "stat5min", last5min)
   updateTimeStatistics(Math.floor(timestamp/ 10000), "statHour", last5min)
   updateTimeStatistics(Math.floor(timestamp/ 1000000), "statDay", last5min)
   updateTimeStatistics(Math.floor(timestamp/ 100000000), "statYear", last5min)
   var datest = Math.floor(timestamp / 100 - (timestamp /100) % 5 )
   console.log("save " + datest.toString() + "count: " + (packetsReceived[0] - last5min[0]).toString());
   last5min = packetsReceived;
}

function updateTimeStatistics(datest, bucket, last) {
   
   db.get(bucket, datest, function(err, stat, meta) {
      if (err) {
         db.save(bucket, datest, { count: sub_array(packetsReceived, last)},
	    {headers:{ "X-Riak-index-date_int": datest }}
	  );
      } else {
          db.save(bucket, datest, { count: add_array(stat.count, sub_array(packetsReceived, last)) },
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
