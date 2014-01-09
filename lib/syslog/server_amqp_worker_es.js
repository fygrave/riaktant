var config = require("../../config/config.js"),
zmqconfig = require("../../config/zmq.js"),
syslogParser = require('glossy').Parse,
es = require('elasticsearchclient'),
os = require('os'),
fs = require('fs'),
crypto = require('crypto'),
util = require('util'),
//amqp = require('amqplib');
zmq = require('zmq'),
sock = zmq.socket('pull');
var xregex = require('xregexp');
var totalReceived, totalErrors, totalPacks, totalBad, lastReceived;

totalErrors = 0;
totalPacks = 0;
totalReceived = 0;
totalBad = 0;
lastReceived = 0;


var cryptopem = fs.readFileSync("./config/server.key");
var cryptokey = cryptopem.toString('ascii');

var messages = [];


sock.connect(zmqconfig.server);

var regs = [];

var cli = new es(config.elasticsearch);
console.log(config.elasticsearch);

var srv = {
    server: null,
    conn: sock,
    exchange: null,
    queue: null
}

function pad(num) {
    return (num < 10 ? '0': '') + num.toString();
}

function get_index() {
    var d = new Date();
    return config.es_index + "-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours())

}

function get_index_type() {
    return config.es_type;
}



function setup() {
    sock.on('message',  function(msg) { storeMessage(msg); });
    setInterval(storeMessages, 2000); // store every 2 seconds
    setInterval(function() { rate = (totalReceived - lastReceived) / 5.0; lastReceived = totalReceived; console.log("Rate: " + rate + "m/s Received: " + totalReceived + " Stored: " + totalPacks + " Errors: " + totalErrors + " bad: " + totalBad); }, 5000);
}


function storeMessages() {
    var locm = messages;
    messages = []; //
    cli.bulk(locm, {})
        .on('data', function(data) {
            d = JSON.parse(data);
            console.log('Store ' + locm.length + ' took ' + d.took);
        })
        .on ('done', function(done) { totalPacks += locm.length;  })
        .on('error', function(error) { console.log("Error " + error); totalErrors++;})
        .exec();

}

function set_stats(exchange) {
    setInterval(function() {
        // optimize index here
        console.log("Commit to indexing");
    },
                10 *1000);
    setInterval(function() {
        require('child_process').exec('df  / | grep dev | awk \'{ print "["$3","$4"]"}\'', function(err, resp) {
            diskUsage = JSON.parse(resp);
        });
    }, 5 * 1000);

}


console.log("Starting worker");
loadRegs();
loadRegsEs();
setInterval(loadRegsEs, 100000); // periodically loading regs
setup();
module.exports = srv
//-----------------------------------------------------------
// --- helpers ---
//-----------------------------------------------------------
//

function loadRegsEs() {
    qryObj = {
        "query":{
            "match_all":{} }
    };
    cli.search('everlog_parser', 'everlog_parser-type', qryObj)
        .on('data', function(data) {
            d = JSON.parse(data)["hits"]["hits"];
            var newregs = [];
            for (var i=0; i<d.length; i++) {
                //console.log(d[i]["_source"]["type"]);
                try {
                    newregs.push([d[i]["_source"]["type"], xregex.XRegExp(d[i]["_source"]["rule"])]);
                } catch (err) {
                    console.log("Error" + JSON.stringify(d[i]));
                }
            }
            regs = loadRegsUpdate(newregs);
            console.log("Loaded " + regs.length + " rules from ES");
        })
        .on('done', function(){
            //always returns 0 right now
        })
        .on('error', function(error){
            console.log(error)
        })
        .exec()

}

function loadRegs() {
    console.log("Loading regs");
    var newregs = [];
    var p_config = fs.readFileSync(config.parser_rules).toString('utf8',0).split('\n');

    for (j=0; j< p_config.length; j++) {
        if (p_config[j].length != 0) {
            k = p_config[j].split('===>');
            newregs.push([k[0], xregex.XRegExp(k[1])]);
        }
    }
    regs = loadRegsUpdate(newregs);
    console.log("Loaded " + regs.length + " rules");



}

function loadRegsUpdate(r) {
	for (j = 0; j< r.length; j++) {
		r[j][2] = xregex.XRegExp(r[j][1])['xregexp']['captureNames']
	}
	return r;
}

function isProperty(v) {
    if (v.match(/^\d+$/)) return false;
    if (v == "index") return false;
    if (v == "input") return false;
    return true;
}




function ruleMatch(parsedMessage) {
        parsedMessage.match="none";
        for (j=0; j< regs.length; j++) {
            //console.log(parsedMessage.message);
            r = xregex.XRegExp.cache(regs[j][1]).exec(parsedMessage.message);
            //r = xregex.XRegExp.exec(parsedMessage.message, regs[j][1]);
            if (r != null) {
                //console.log(regs[j][0]);
                //console.log(r);
                parsedMessage.match = regs[j][0];
                for (var vals in regs[j][2]) {
                    fname = regs[j][2][vals]

                    parsedMessage[fname] = r[parseInt(vals) + 1];

                }
            }
        }
    return parsedMessage;
}

function storeMessage(m) {
    totalReceived++;

    var dats = m.toString();
    var address = dats.substring(0, dats.indexOf('|'));
    var rawMessage = dats.substring(dats.indexOf('|')+1, dats.length);
    //console.log("Address " + address + " message " + rawMessage);

    try {
        syslogParser.parse(rawMessage, function(parsedMessage) {
            var sign = crypto.createSign('RSA-SHA1');
            sign.update(parsedMessage.originalMessage);
            if (! parsedMessage.hasOwnProperty('message')) {
                parsedMessage.message = parsedMessage.originalMessage;
                parsedMessage.host = address
                parsedMessage.class = "syslog-malformed"
                parsedMessage.time = new Date();
                totalBad++;
            }

            parsedMessage.cryptosignature = sign.sign(cryptokey, 'base64');
            parsedMessage.origin = address
            parsedMessage.class = "syslog"
            parsedMessage.severity = 0
            parsedMessage.sensor = getSourceID()
            parsedMessage.message = clearNulls(parsedMessage.message);

            if (parsedMessage.severityID) {
                parsedMessage.severity = parsedMessage.severityID;
            } else {
                parsedMessage.severity = -1;
            }
// do rule matching

            parsedMessage = ruleMatch(parsedMessage);
// do some cleanup
            delete parsedMessage.message;
            delete parsedMessage.severityID;
            delete parsedMessage.facilityID;


            messages.push({"index":{"_index":get_index(), "_type":get_index_type()}});
            messages.push(parsedMessage);
            //console.log(JSON.stringify(messages));


        }); // parse
    } catch(err) {
        console.log("Error: " + err + " while parsing " + rawMessage.toString('utf8'));
        totalErrors++;
        parsedMessage = {
            originalMessage: rawMessage.toString('utf8'),
            origin: address,
            class: "bad"
        };
    }


}


function getSourceID() {
    // javascript get host by name?

    return os.hostname();
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
  totalErrors++;
});
