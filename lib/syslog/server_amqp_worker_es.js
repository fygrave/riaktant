var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
es = require('elasticsearchclient'),
crypto = require('crypto'),
util = require('util'),
amqp = require('amqp');

var cli = new es(config.elasticsearch);

var srv = {
	server: null,
	conn: null,
	exchange: null,
	queue: null
}

function pad(num) {
    return (num < 10 ? '0': '') + num.toString();
}

function get_index() {
    var d = new Date();
return config.es_index + "-" + d.FullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) 

}

function get_index_type() {
    return config.es_type;
}



function setup() {

  console.log("running setup.. ");
  var exchange = conn.exchange(amqp_config.exchange, {'type': 'topic', durable: false}, function() {
    srv.exchange = exchange
    console.log("statz");
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
	},10 *1000);

	
	setInterval(function() {

		require('child_process').exec('df  / | grep dev | awk \'{ print "["$3","$4"]"}\'', function(err, resp) {
		diskUsage = JSON.parse(resp);
		});
	}, 5 * 1000);

}


console.log("Starting worker AMQP URL: " + amqp_config.url);
var conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

module.exports = srv
//-----------------------------------------------------------
// --- helpers ---
//-----------------------------------------------------------



function storeMessage(msg, q) {
    var hash = crypto.createHash('sha1')
    hash.update(JSON.stringify(msg.body))
    hash.update(process.pid.toString())
    hash.update(new Date().toString())
    
   msg.body.id  =  hash.digest("hex");

   var messages = [];
   messages.push({"index":{"_index":get_index(), "_type":get_index_type()}});
   messages.push(msg.body);
   q.shift();
	
   	cli.bulk(messages, {})
    .on('data', function(data) {
        d = JSON.parse(data);
        console.log('Store took ' + d.took);
        })
    .on ('done', function(done) { console.log("Done"); })
    .on('error', function(error) { console.log("Error " + error); })
    .exec();
    
}

//process.on('uncaughtException', function(err) {
//  console.log("Uncaught Error " + err);
//});

