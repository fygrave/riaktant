var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
es = require('elasticsearchclient'),
fs = require('fs'),
crypto = require('crypto'),
util = require('util'),
//amqp = require('amqplib');
zmq = require('zmq'),
sock = zmq.socket('pull');
var xregex = require('xregexp');
var totalReceived, totalErrors, totalPacks;

totalErrors = 0;
totalPacks = 0;
totalReceived = 0;

sock.connect('tcp://127.0.0.1:3000');

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
return config.es_index + "-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) 

}

function get_index_type() {
    return config.es_type;
}



function setup() {


    sock.on('message',  function(msg) { storeMessage(msg); });
    setInterval(function() { console.log("Received " + totalReceived + " Stored " + totalPacks + " Errors " + totalErrors); }, 10000); 
}


function set_stats(exchange) {
	
	setInterval(function() {
        // optimize index here
		console.log("Commit to indexing");
	},10 *1000);

	
	setInterval(function() {

		require('child_process').exec('df  / | grep dev | awk \'{ print "["$3","$4"]"}\'', function(err, resp) {
		diskUsage = JSON.parse(resp);
		});
	}, 5 * 1000);

}


console.log("Starting worker AMQP URL: " + amqp_config.url);
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
        regs = newregs;
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
    regs = newregs;
    console.log("Loaded " + regs.length + " rules");



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
            r = xregex.XRegExp.exec(parsedMessage.message, regs[j][1]);
            if (r != null) {
                //console.log(regs[j][0]);
                //console.log(r);
                parsedMessage.match = regs[j][0];
                for (var vals in r) {
                    if (isProperty(vals)) {
                        parsedMessage[vals] = r[vals];
                    }
                }
            }
            
        }
    return parsedMessage;	
}

function storeMessage(m) {
    totalReceived++;
    msg = JSON.parse(m);
    msg.body = ruleMatch(msg.body);
    var hash = crypto.createHash('sha1')
    hash.update(JSON.stringify(msg.body))
    hash.update(process.pid.toString())
    hash.update(new Date().toString())
    //console.log(JSON.stringify(msg.body));
    
   //msg.body.id  =  hash.digest("hex");

   var messages = [];
   messages.push({"index":{"_index":get_index(), "_type":get_index_type()}});
   messages.push(msg.body);
   //console.log(JSON.stringify(messages));
	
   	cli.bulk(messages, {})
    .on('data', function(data) {
        d = JSON.parse(data);
        //console.log('Store took ' + d.took);
        })
    .on ('done', function(done) { totalPacks++;  })
    .on('error', function(error) { console.log("Error " + error); totalErrors++;})
    .exec();
    
}

process.on('uncaughtException', function(err) {
  console.log("Uncaught Error " + err);
});

