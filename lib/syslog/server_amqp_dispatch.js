var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
syslogParser = require('glossy').Parse,
Iconv   = require('iconv').Iconv,
dgram = require('dgram'),
os = require('os'),
crypto = require('crypto'),
fs = require('fs'),
riak = require('riak-js'),
//amqp = require('amqplib')
zmq = require('zmq'),
sock = zmq.socket('push');
sock.bindSync('tcp://127.0.0.1:3000');

when = require('when');

var iconv = new Iconv("big5", "UTF-8");

var cryptopem = fs.readFileSync("./config/server.key");
var cryptokey = cryptopem.toString('ascii');

var db = riak.getClient(config);
var classifications  = {};

var packets = 0;
var failed = 0;
var srv = {
	server: null,
	conn: sock,
	exchange: null,
	livetail: null,
	livetailq: null,
	queue: null
}

function setup() {

    console.log("setup");
    //ch.assertExchange('livetailq', { durable: false, exclusive: false, 'x-message-ttl': 6000 });
    //ch.assertQueue( amqp_config.work_queue, {durable: false, exclusive: false, "x-message-ttl": 1000 * 60});
    syslog_server();
}

function printStatus() {
	console.log("Syslog received packets: " + packets.toString() + " failed to parse: " + failed.toString())
}

function syslog_server() {

    var server = dgram.createSocket("udp4")
    server.on("message", function(rawMessage, rinfo) {
	packets++;
	try {
		handleSyslogMessage(iconv.convert(rawMessage), rinfo)
	} catch (err) {
		console.log("Caught exception: " + err + " while processing <<" + rawMessage + ">>");
	}
    });


    server.on("listening", function(){
	var address = server.address()
  	console.log("Syslog server listening at " + address.address + ":" + address.port)
    });

    server.on("close", function(){
 	console.log("Syslog server shutting down.")
    });
    setInterval(printStatus, 10000);


    server.bind(config.syslog_port)
    srv.server = server
}


setup();


module.exports = srv
//-----------------------------------------------------------
// --- helpers ---
//-----------------------------------------------------------
function getSourceID() {
    // javascript get host by name?

    return os.hostname();
}
function handleSyslogMessage( rawMessage, rinfo) {

  try {
      syslogParser.parse(rawMessage, function(parsedMessage) {
          var sign = crypto.createSign('RSA-SHA1');
          sign.update(parsedMessage.originalMessage);
          if (! parsedMessage.hasOwnProperty('message')) {
              parsedMessage.message = parsedMessage.originalMessage;
              parsedMessage.host = rinfo.address
              parsedMessage.class = "syslog-malformed"
              parsedMessage.time = Date()
          }
          parsedMessage.cryptosignature = sign.sign(cryptokey, 'base64');
          parsedMessage.origin = rinfo.address
          parsedMessage.class = "syslog"
          parsedMessage.severity = 0
          parsedMessage.sensor = getSourceID()
          parsedMessage.date = getDateInt()
          parsedMessage.message = clearNulls(parsedMessage.message);
          parsedMessage.originalMessage = clearNulls(parsedMessage.originalMessage);

          if (parsedMessage.severityID) {
              parsedMessage.severity = parsedMessage.severityID;
          } else {
              parsedMessage.severity = -1;
          }
          parsedMessage.date = getDateInt()
          passMessageStore(parsedMessage);
          passMessageLiveTail(parsedMessage);
          passMessageCEP(parsedMessage);

      }); // parse
  } catch(err) {
      console.log("Error: " + err + " while parsing " + rawMessage.toString('utf8'));
      parsedMessage = {
          originalMessage: rawMessage.toString('utf8'),
          origin: rinfo.address,
          class: "bad"
      };
    }

}

function passMessageLiveTail(parsedMessage) {
	//srv.conn.sendToQueue(parsedMessage.origin, { body: parsedMessage });
}

function passMessageCEP(parsedMessage) {
}



function passMessageStore(parsedMessage) {
    //console.log(JSON.stringify(parsedMessage));
    srv.conn.send(JSON.stringify({ body: parsedMessage  }));

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

// some loggers include ending 0s. so we need to clean'em up
function clearNulls(buf) {
       buf = buf.replace(/\0/g, '');
       return buf;
}




process.on('uncaughtException', function(err) {
  console.log("Uncaught Error " + err);
});
