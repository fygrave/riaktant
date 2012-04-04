var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
dgram = require('dgram'),
solr = require('node-solr'),
riak = require('riak-js'),
crypto = require('crypto'),
util = require('util'),
amqp = require('amqp');

var db = riak.getClient(config);
var solrc = solr.createClient();

var srv = {
	server: null,
	conn: null,
	exchange: null,
	queue: null
}

var packetsReceived = [0,0,0,0];
var packetsStored = [0,0,0,0];
var diskUsage = [0,0];
var lost = 0;


function setup() {

  console.log("running setup.. ");
  var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {
    srv.exchange = exchange
    var working_queue = conn.queue(amqp_config.work_queue, { durable: false, exclusive: false },
    function() {
    	working_queue.subscribe({ack: true}, function(msg) { storeMessage(msg, working_queue); });
    });

    set_stats(exchange); 
  }); 
}


function set_stats(exchange) {
	
	setInterval(function() {
		solrc.commit();
		console.log("Commit to indexing");
	},20 *1000);

	setInterval(function() {
	 //   var stats = { packetsReceived: packetsReceived, packetsStored: packetsStored, overhead: packetsReceived - packetsStored, time: getDateInt() };
         //   exchange.publish('worker', stats);
	    console.log("Worker " + process.pid.toString() + " PacketsReceived: " + packetsReceived.toString()  + " Packets Lost: " + lost);
            packetsReceived = [0,0,0,0];
            packetsStored = [0,0,0,0];
        }, 10  * 1000); // every 20 sec
	
	setInterval(function() {

		require('child_process').exec('df  / | grep dev | awk \'{ print "["$3","$4"]"}\'', function(err, resp) {
		diskUsage = JSON.parse(resp);
		});
	}, 5 * 1000);

       setInterval(updateSystem, 10 * 1000); // every 5 min

}


console.log("Starting worker AMQP URL: " + amqp_config.url);
var conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

module.exports = srv
//-----------------------------------------------------------
// --- helpers ---
//-----------------------------------------------------------
// update system data
function updateSystem() {
	console.log("update System");
	db.stats({}, function(err, arg, meta) {
	if (err) {
		console.log("Error getting stats " + JSON.stringify(err));
		return;
	}
	if (arg == null) {
		console.log("stats are not defined");
		return;
	}
	var data = {}
	var members = arg.ring_members;
	var member = arg.nodename;
	db.get('system', member, function(err, pack, meta) {
		if (!meta) return; // connection drop?
		data.disk = diskUsage;
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
		

		console.log( "saving " + meta.key + " meta " + JSON.stringify(meta) + "\ndata\n" + JSON.stringify(data));
		db.save('system', meta.key, data);
		}); 
	});
}



function storeMessage(msg, q) {
// TODO: total stats are to be updated
// TODO: filtering
//  console.log(msg)
//console.log("got message " + msg.body + "from " +  msg.rinfo.address)
    packetsReceived[0]++;
    var hash = crypto.createHash('sha1')
    hash.update(JSON.stringify(msg.body))
    hash.update(process.pid.toString())
    hash.update(new Date().toString())
    
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
   msg.body.id  =  hash.digest("hex");
  // console.log(JSON.stringify(msg.body));

  //  db.save('syslog3', msg.body.id, msg.body,
//	    {headers:{
//		"X-Riak-index-date_int": msg.body.date,
//		"X-Riak-index-host_bin": msg.body.host,
//		"X-Riak-index-origin_bin": msg.body.origin,
//		"X-Riak-index-sensor_bin": msg.body.sensor
//	    }}, function(err) {
//		if (err) {
//			//console.log(err);
//			console.log(err);
//			console.log("error saving " + msg.body);
//			lost++;
//		} 
//		//q.shift();
//		});

   solrc.add(msg.body, function(err) {
	if (err) {
			console.log(err);
			console.log("solr error saving <<" + JSON.stringify(msg.body) + ">>");
			lost++;
	}
	q.shift();
	});
   db.get('origins', msg.body.origin, function(err, orig, meta) {
	if (err) {
		if (err.code != "ECONNRESET") {
		    db.save('origins', msg.body.origin, { count: 1, date: msg.body.date});
		}
	} else {
		orig.count = orig.count + 1;
		orig.date = msg.body.date;
		db.save('origins', msg.body.origin, orig);
	}
	});	
    
    packetsStored[0]++;
}

var padInteger = function(number) {
	  return (number < 10 ? '0' : '') + number.toString()    
}



var getDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes()) + padInteger(d.getSeconds())
    return parseInt(dateline)

}


