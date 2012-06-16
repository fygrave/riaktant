var syslogProducer = require('glossy').Produce,
    config = require("../../config/config.js"),
    amqp_config = require("../../config/amqp.js"),
    solr = require('node-solr'),
    dgram = require('dgram');

var logHost = "172.16.17.17"; // should be config
var producer = new syslogProducer();
var solrc = solr.createClient();
var udpclient = dgram.createSocket("udp4");
var timeInter = 10; // check for alarms every 10 seconds

function setup() {
    console.log("Forwarder started. Forwarding alerts every " + timeInter + " seconds");
    setInterval(forwardAlarms, timeInter  * 1000); // every 20 sec
}

function forwardAlarms() {
   var datest = getDateInt();
   var qry = "date:[" + (datest - timeInter) + " TO " + datest + "] AND alert:true";
   solrc.query(qry, config.solr_params, function(err, response) {
	if (err) {
		console.log(err);
		return;
	}
	var r = JSON.parse(response);
	//console.log(r);
	var docs = r.response.docs;
	console.log("forwarding " + docs.length + " messages");
	for (var i=0; i< docs.length; i++) {
		var hsh = {
			facility: docs[i].facility,
			severity: docs[i].severity,
			host: docs[i].origin, //msg.origin,
			date: new Date(),
			message: docs[i].message
		}
//		console.log(hsh);
		var msg = producer.produce(hsh);
		var message = new Buffer(msg);
		udpclient.send(message, 0, message.length, 514, logHost, function(err) { if (err) { throw err; }});
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


setup();
