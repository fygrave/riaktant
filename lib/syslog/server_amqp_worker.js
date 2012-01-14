var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
dgram = require('dgram'),
riak = require('riak-js'),
crypto = require('crypto'),
util = require('util'),
amqp = require('amqp');

// Create a Riak client
var db = riak.getClient(config)

var srv = {
	server: null,
	conn: null,
	exchange: null,
	queue: null
}

var packetsReceived = [0,0,0,0];
var packetsStored = [0,0,0,0];
var last5min = []; // 12 items for each 5 mins in hour
var lastHour = []; // 24 item for each hour of day
var lastDay = []; // 30 items for each month
var lastMonth = []; // 12 items. for each year

function setup() {

  var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {
    srv.exchange = exchange
    var working_queue = conn.queue(amqp_config.work_queue, { durable: false, exclusive: false },
    function() {
    	working_queue.subscribe(function(msg) { storeMessage(msg); });
    });

    set_stats(exchange); 
  }); 
}


function set_stats(exchange) {

	setInterval(function() {
	    var stats = { packetsReceived: packetsReceived, packetsStored: packetsStored, overhead: packetsReceived - packetsStored, time: getDateInt() };
            exchange.publish('worker', stats);
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

function storeMessage(msg) {
// TODO: total stats are to be updated
// TODO: filtering
    //console.log("got message " + msg.body + "from " +  msg.rinfo.address)
    packetsReceived[0]++;
    var hash = crypto.createHash('sha1')
    hash.update(JSON.stringify(msg.body))
    hash.update(process.pid.toString())
    hash.update(new Date().toString())
    
    db.save('syslog', msg.body.host + "_" + hash.digest("hex"), msg.body,
	    {headers:{
		"X-Riak-index-date_int": msg.body.date,
		"X-Riak-index-host_bin": msg.body.host,
		"X-Riak-index-origin_bin": msg.body.origin,
		"X-Riak-index-sensor_bin": msg.body.sensor
	    }});
    
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


