var config = require("../../config/config.js"),
    amqp_config = require("../../config/amqp.js"),
    syslogParser = require('glossy').Parse,
    dgram = require('dgram'),
    riak = require('riak-js'),
    crypto = require('crypto'),
    amqp = require('amqp');

// Create a Riak client
var db = riak.getClient(config)

var srv = {
	server: null,
	conn: null,
	exchange: null,
	queue: null
}

var packetsReceived = 0;
var packetsStored = 0;
var last5min = []; // 12 items for each 5 mins in hour
var lastHour = []; // 24 item for each hour of day
var lastDay = []; // 30 items for each month
var lastMonth = []; // 12 items. for each year

function setup() {

  var exchange = conn.exchange(amqp_config.exchange, {'type': 'fanout', durable: false}, function() {
    srv.exchange = exchange
    var queue = conn.queue('', {durable: false, exclusive: true},
    function() {
      queue.subscribe(function(msg) {
        storeMessage(msg);
      });
      queue.bind(exchange.name, '');
    });
    srv.queue = queue;
    queue.on('queueBindOk', function() { syslog_server(exchange); });
  });
}


function syslog_server(exchange) {

	var server = dgram.createSocket("udp4")
	server.on("message", function(rawMessage, rinfo) {
		packetsReceived++;
		handleSyslogMessage(exchange, rawMessage, rinfo)
	});

	
	server.on("listening", function(){
		var address = server.address()
  		console.log("Syslog server listening at " + address.address + ":" + address.port)
	});
	
	server.on("close", function(){
 		console.log("Syslog server shutting down.")
	});

	server.bind(10514)
        srv.server = server
	setInterval(updateTotalStatistics, 10  * 1000); // every 20 sec
	setInterval(update5minStatistics, 5 * 60 * 1000); // every 5 min
	setInterval(updateHourStatistics, 60 * 60 * 1000); // every hour
	setInterval(updateDayStatistics, 24 * 60 * 60 * 1000); // every day
	setInterval(updateMonthStatistics,  30 * 24 * 60 * 60 * 1000); // every month
}


console.log("Starting ... AMQP URL: " + amqp_config.url);
var conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

module.exports = srv
//-----------------------------------------------------------
// --- helpers ---
//-----------------------------------------------------------
function handleSyslogMessage(exchange, rawMessage, rinfo) {
	exchange.publish('',{body: rawMessage.toString('utf8', 0), rinfo: rinfo});

}

function updateTotalStatistics() {
	db.get('statistics', config.nodeid, function(err, packs, meta) {
		if (err) {
			var stats = { packetsReceived: packetsReceived, lastupdate: getDateInt() };
			db.save('statistics', config.nodeid, stats)
		} else {
			if (packetsReceived < packs.packetsReceived) {
			   packetsReceived = packs.PacketsReceived + packetsReceived
			}
			packs.packetsReceived = packetsReceived
			packs.lastupdate = getDateInt()
			db.save('statistics', config.nodeid, packs)
		}
	
	});

	db.get('intervals', config.nodeid, function(err, intervals, meta) {
		if (err) {
			var inters = {
				last5min: last5min,
				lastHour: lastHour,
				lastDay: lastDay,
				lastMonth: lastMonth
			};
			db.save('intervals', config.nodeid, inters);
		} else {
			if (intervals.last5min.length > last5min.length) { last5min = intervals.last5min };
			if (intervals.lastHour.length > lastHour.length) { lastHour = intervals.lastHour };
			if (intervals.lastDay.length > lastDay.length) { lastDay = intervals.lastDay };
			if (intervals.lastMonth.length > lastMonth.length) { lastMonth = intervals.lastMonth };
			
		}
	});



	console.log("PacketsReceived: " + packetsReceived.toString()  + " PacketsStored: " + packetsStored.toString());
}
function update5minStatistics() {
		last5min.push(packetsStored);
		packetsStored = 0;
		if (last5min.length > 12) { last5min.shift(); }
}


function updateHourStatistics() {
		lastHour.push(sumArray(last5min));
		if (lastHour.length > 24) { lastHour.shift(); }
}


function updateDayStatistics() {
		lastDay.push(sumArray(lastHour));
		if (lastDay.length > 30) { lastDay.shift(); }
}

// we will need at least one full month of execution to have this complete
function updateMonthStatistics() {
		lastMonth.push(sumArray(lastDay));
		if (lastMonth.length > 12) { lastMonth.shift(); }
}

function sumArray(arr) {
    var sum = 0;
    arr.forEach(function(el) { sum = sum + el});
    return sum
}

function storeMessage(msg) {
// TODO: total stats are to be updated
// TODO: filtering
	//console.log("got message " + msg.body + "from " +  msg.rinfo.address)
	syslogParser.parse(msg.body, function(parsedMessage) {
		parsedMessage.origin = msg.rinfo.address
		parsedMessage.class = "syslog"
		parsedMessage.severity = 0
		parsedMessage.sensor = process.pid.toString()
		if (parsedMessage.severityID) {
			parsedMessage.severity = parsedMessage.severityID;
		}
		var hash = crypto.createHash('sha1')
		hash.update(JSON.stringify(parsedMessage))
		hash.update(process.pid.toString())
		hash.update(new Date().toString())
		var dateline = getDateInt()
		parsedMessage.date = getDateInt()
		db.save('syslog', parsedMessage.host + "_" + hash.digest("hex"), parsedMessage,
			{headers:{
				"X-Riak-index-date_int": dateline,
				"X-Riak-index-host_bin": parsedMessage.host,
				"X-Riak-index-origin_bin": parsedMessage.origin
			      }});

		packetsStored++;
 
	});

}

var padInteger = function(number) {
	  return (number < 10 ? '0' : '') + number.toString()    
}



var getDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes()) + padInteger(d.getSeconds())
    return parseInt(dateline)

}


