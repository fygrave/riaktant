var config = require("../../config/config.js"),
zmqconfig = require("../../config/zmq.js"),
Iconv   = require('iconv').Iconv,
dgram = require('dgram'),
os = require('os'),
crypto = require('crypto'),
fs = require('fs'),
riak = require('riak-js'),
//amqp = require('amqplib')
zmq = require('zmq'),
sock = zmq.socket('push');
sock.bindSync('tcp://*:3000');

when = require('when');

var iconv = new Iconv("big5", "UTF-8");

var cryptopem = fs.readFileSync("./config/server.key");
var cryptokey = cryptopem.toString('ascii');

var db = riak.getClient(config);
var classifications  = {};

var packets = 0;
var failed = 0;
var last = 0;
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
    rate = (packets - last )/ 10.0;
    last = packets;
    console.log("Syslog received packets: " + packets.toString() + " Rate: " + rate + " failed: " + failed.toString())
}

function syslog_server() {

    var server = dgram.createSocket("udp4")
    server.on("message", function(rawMessage, rinfo) {
        packets++;
        try {
            handleSyslogMessage(iconv.convert(rawMessage.toString('utf-8')), rinfo)
        } catch (err) {
            failed++;
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

function handleSyslogMessage( rawMessage, rinfo) {

    srv.conn.send(Buffer.concat([new Buffer(rinfo.address), new Buffer("|"), new Buffer(rawMessage)]))
}



process.on('uncaughtException', function(err) {
  console.log("Uncaught Error " + err);
});
