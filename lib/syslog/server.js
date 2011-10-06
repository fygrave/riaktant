// Require needed libraries and config
var config = require("../../config/config.js"),
    syslogParser = require('glossy').Parse,
    dgram = require('dgram'),
    riak = require('riak-js'),
    crypto = require('crypto')

// Create a Riak client
var db = riak.getClient(config)

// Create the UDP syslog server
var server = dgram.createSocket("udp4")

// Measure perf and reduce backpressure
var packetsReceived = 0;
var messageQueue = [];
  

var padInteger = function(number) {
	  return (number < 10 ? '0' : '') + number.toString()    
}



var getDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes()) + padInteger(d.getSeconds())
    return parseInt(dateline)

}

var getShortDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes())
    return parseInt(dateline)

}



// Enqueue a log message when received
server.on("message", function(rawMessage, rinfo){
  packetsReceived++;
  syslogParser.parse(rawMessage.toString('utf8', 0), function(parsedMessage){
    // Create a mostly-unique hash for the key
    // If using HTTP, this could be created for us
    //      parsedMessage.host = rinfo.address
      parsedMessage.origin = rinfo.address
      parsedMessage.sensor = "127.0.0.1"
      parsedMessage.class = "syslog"
      parsedMessage.severity = 0
      if (parsedMessage.severityID) {
	  parsedMessage.severity = parsedMessage.severityID;
      }
      parsedMessage.service = "unknown"
      parsedMessage.type = "local"
      var hash = crypto.createHash('sha1')
      hash.update(JSON.stringify(parsedMessage))
      hash.update(process.pid.toString())
      hash.update(new Date().toString())

     
      var dateline = getShortDateInt()
      parsedMessage.date = getDateInt()

     
      //console.log(hash.digest("hex"))
      //console.log(dateline)
      //console.log(parsedMessage)
      messageQueue.push([parsedMessage.host + "_" + hash.digest("hex"), parsedMessage, dateline]);
  })
})

// Check the queue size every 0.5 seconds
server.drainFreq = 500
server.drainInterval = null

// Log the queue size every 5 seconds
server.logFreq = 5000
server.logInterval = null

// Process a message from the queue until it's empty
var processNextQueueMessage = function(){
  if(messageQueue.length > 0){
    var message = messageQueue.shift()
      console.log("storring message " + message[0]+ "; " + message[2]  + "; left " + messageQueue.length)
      db.save('syslog', message[0], message[1],  
	      {headers:{
		  "X-Riak-index-date_int": message[2],
		  "X-Riak-index-host_bin": message[1].host,
		  "X-Riak-index-origin_bin": message[1].origin
	      }
	      }, processNextQueueMessage)
  } else {
    console.log("Queue drained")
    server.drainInterval = setInterval(drainQueue, server.drainFreq)
  }
}

// Don't start draining the queue until there's some messages in it
var drainQueue = function(){
  if(messageQueue.length > 100){
    console.log("Queue size: "+ messageQueue.length)
    // Stop polling until it's drained
    clearInterval(server.drainInterval)
    // Schedule message processing for the next cycle
    process.nextTick(processNextQueueMessage)
  }
}

// Log the startup, start our periodic timers
server.on("listening", function(){
  var address = server.address()
  console.log("Syslog server listening at " + address.address + ":" + address.port)

  // Print to the console the message count on an interval
  if(server.logFreq > 0){
    server.logInterval = setInterval(function() {
	db.get('statistics',config.nodeid, function(err, packs, meta) {
	    if (err) {
		var stats = { packetsReceived: packetsReceived, lastupdate: getDateInt() }
	    
		db.save('statistics',config.nodeid, stats)
	    } else {
		if (packetsReceived < packs.packetsReceived) {
		    packetsReceived = packs.packetsReceived + packetsReceived
		}
		packs.packetsReceived = packetsReceived
		packs.lastupdate = getDateInt()
		db.save('statistics', config.nodeid, packs)
	    }
	})
      console.log("received " + packetsReceived + " messages so far");
    }, 5000)
  }

  // Drain the queue regularly
  if(server.drainFreq > 0){
    server.drainInterval = setInterval(drainQueue, server.drainFreq)
  }
})

// Log shutdown
server.on("close", function(){
  console.log("Syslog server shutting down.")
  clearInterval(server.drainInterval)
  clearInterval(server.logInterval)
})

module.exports = server
