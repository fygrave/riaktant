var config = require("../../config/config.js"),
    amqp_config = require("../../config/amqp.js"),
    syslogParser = require('glossy').Parse,
    dgram = require('dgram'),
    riak = require('riak-js'),
    crypto = require('crypto'),
    amqp = require('amqp');


var db = riak.getClient(config)

var packetsReceived = 0;
var timestamp = 0;
var overhead = 0;
var last5min = 0;
var lastHour = 0;
var lastDay = 0;
var lastMonth = 0;

function setup() {

  var exchange = conn.exchange(amqp_config.exchange, {'type': 'fanout', durable: false}, function() {

    var queue = conn.queue('', {durable: false, exclusive: true},
    function() {
      queue.subscribe(function(msg) {
	update_stats(msg);
      });
      queue.bind(exchange.name, '');
    });
  });
 // setInterval(updateTotalStatistics, 10  * 1000); // every 20 sec
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

function update_stats(msg) {

     packetsReceived = packetsReceived + msg.packetsReceived
     overhead = overhead + msg.overhead
     timestamp = msg.time
     console.log(timestamp + "upd pkts: " +  packetsReceived + " -> " + msg.packetsReceived + ", " + overhead)
}

function update5minStatistics() {
	var datest = Math.floor(timestamp / 100) - (timestamp % 5)
        console.log("save " + datest.toString() + "count: " + (packetsReceived - last5min).toString());
	db.save('stat5min', datest, {count: packetsReceived - last5min},
			{headers:{ "X-Riak-index-date_int": datest }}
);
	last5min = packetsReceived;
}

function updateHourStatistics() {
	var datest = Math.floor(timestamp / 10000)
	db.save('statHour', datest, {count: packetsReceived - lastHour},
			{headers:{ "X-Riak-index-date_int": datest }}
);
	lastHour = packetsReceived;
}

function updateDayStatistics() {
	var datest = Math.floor(timestamp / 1000000)
	db.save('statDay', datest, {count: packetsReceived - lastDay},
			{headers:{ "X-Riak-index-date_int": datest }}
);
	lastDay = packetsReceived;
}

function updateMonthStatistics() {
	var datest = Math.floor(timestamp / 100000000)
	db.save('statMonth', datest, {count: packetsReceived - lastMonth},
			{headers:{ "X-Riak-index-date_int": datest }}
);
	lastMonth = packetsReceived;
}

