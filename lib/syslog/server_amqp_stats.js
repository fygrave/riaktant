var config = require("../../config/config.js"),
    amqp_config = require("../../config/amqp.js"),
    syslogParser = require('glossy').Parse,
    dgram = require('dgram'),
    solr = require('node-solr'),
    riak = require('riak-js'),
    crypto = require('crypto'),
    amqp = require('amqp');


var db = riak.getClient(config)
var solrc = solr.createClient(config.solr_params);

var timestamp = 0;

function setup() {

    var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {

	var source_queue = conn.queue('source', { durable: false, exclusive: true},
				      function() {
					  source_queue.subscribe(function(msg, headers, deliveryInfo) {
					      
					      update_source(msg);
					   
					  });
					  source_queue.bind(exchange.name, 'source');
				      });
    });
    setInterval(updateTotalStatistics, 10  * 1000); // every 20 sec
    setInterval(update5minStatistics, 30 * 1000); // every 30 sec

}


var conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

//-----------------------------
//-- helpers 
//----------------------------



function updateTotalStatistics() {
    var totalKey = 'total_packets';
    var query = "*:*";
    var qparams = config.solr_params;
	qparams.rows = 0;
    solrc.query(query, qparams, function(err, response) {
	if (err) {
		console.log(err);
		return;
	}

	var r = JSON.parse(response);
	var stats = {packetsReceived: r.response.numFound , lastupdate: getDateInt() };
	db.save('statistics', totalKey, stats);
    });

}

function getStat(query, key, bucket) {
   var datest = getDateInt();
    var qparams = config.solr_params;
	qparams.rows = 0;
   solrc.query(query, qparams, function(err, response) {
	if (err) {
		console.log(err);
		return;
	}
	var r = JSON.parse(response);
	var rez = [  r.response.numFound, 0, 0, 0];
   	solrc.query(query + " AND severityID:[0 TO 3]", qparams, function(err, response) {
		if (err) {
			console.log(err);
			return;
		}
		var r = JSON.parse(response);
		rez[1] = r.response.numFound;
   		solrc.query(query + " AND severityID:[4 TO 5]", qparams, function(err, response) {
			if (err) {
				console.log(err);
				return;	
			}	
			var r = JSON.parse(response);
			rez[2] = r.response.numFound;
			rez[3] = rez[0] - rez[1] - rez[2];
   			updateTimeStatistics(key, bucket, rez)
		});
	});
    });
 
}

function update5minStatistics() {
   var datest = getDateInt();
    var qparams = config.solr_params;
	qparams.rows = 0;
   var q5min = "date:[" + (Math.floor(datest/ 100 - (datest/100) %5) * 100) + " TO " + (Math.floor(datest/100 - (datest/100) % 5) * 100 + 500) + "]";
   var qHour = "date:[" + (datest - datest % 10000) + " TO " + (datest - datest % 10000 + 10000) + "]"; 
   var qDay = "date:[" + (datest - datest % 1000000) + " TO " + (datest - datest % 1000000 + 1000000) + "]"; 
   var qYear = "date:[" + (datest - datest % 100000000) + " TO " + (datest - datest % 100000000 + 100000000) + "]"; 
   getStat(q5min, Math.floor(datest/ 100 - (datest/100) %5 ), "stat5min");
   getStat(qHour, Math.floor(datest/ 10000), "statHour");
   getStat(qDay, Math.floor(datest/ 1000000), "statDay");
   getStat(qYear, Math.floor(datest/ 100000000), "statYear");
}

function updateTimeStatistics(datest, bucket, lastv) {
   
   console.log("updateTimeStat: " + datest + " " + JSON.stringify(lastv));
   db.save(bucket, datest, { count: lastv},
	    {headers:{ "X-Riak-index-date_int": datest }}
	  );
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


// refactor getDateInt into utils.. or something
var padInteger = function(number) {
    return (number < 10 ? '0' : '') + number.toString()    
}



var getDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes()) + padInteger(d.getSeconds())
    return parseInt(dateline)

}
