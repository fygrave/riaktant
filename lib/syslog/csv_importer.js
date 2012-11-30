var config = require("../../config/config.js"),
amqp_config = require("../../config/amqp.js"),
amqp = require('amqp');
console.log("start data import");
console.time("import");
var Bagpipe = require("bagpipe")
var fs = require("fs");
var bagpipe = new Bagpipe(100);
var lazy = require('lazy')
require('date-utils')

var queue = "";
var conn = "";

var dive = function (dir, action) {
  // Assert that it's a function
  if (typeof action !== "function")
    action = function (error, file) { };

  // Read the directory
  fs.readdir(dir, function (err, list) {
    // Return the error if something went wrong
    if (err)
      return action(err);

    // For every file in the list
    list.forEach(function (file) {
      // Full path of that file
      var path = dir + "/" + file;
      // Get the file's stats
      fs.stat(path, function (err, stat) {
        //console.log(path + " size " + stat.size);
        // If the file is a directory
        if (stat && stat.isDirectory())
          // Dive into the directory
          dive(path, action);
        else
          // Call the action
	  //console.log(path);
          action(null, path);
      });
    });
  });
};


var readFiles = []
var activeFiles = 0;
var imdata = function (a, path) {
       readFiles.push(path);
}

setInterval(function() {

while (readFiles.length != 0 && activeFiles < 5) {
var file = readFiles.shift();
doreadFile(file); 
}

}, 100);

function doreadFile(path) {


	var header;

	activeFiles++;
	//console.log("file " + path + " now reading " +activeFiles);
	var pattern = /(?:^|,)("(?:[^"]+)*"|[^,]*)/g;
	var iteration = 0;
	var fp = fs.createReadStream(path);
	console.time(path);
	
	fp.on('end', function() { eof = true; console.timeEnd(path); fp.destroy(); activeFiles--;});


	lazy(fp).lines.forEach(function(l) {
		var d = "" + l
		if (!l) {
			console.log("l is empty");
		}
		var items = d.split(',');
		//console.log(iteration);
		if (iteration++ == 0) { 
			header = items;
			//console.log(JSON.stringify(header));
		}
		else {
			var doc = {}
			var index = 0;
			header.forEach(function(name) {
				// our awesome heurestics ;-)
				var item = items[index++];
				if (!isNaN(item) && item.length != 0) {
				// index integer
				doc[name.toLowerCase().replace(/[\s-\/]+/gi,"_").replace(/[\.()]/gi,"")+ "_i"] = parseInt(item);
				} else if (item.length != 0 && item.match(/^\d{4}\/\d{1,2}\/\d{1,2}.*/) && Date.parse(item) != "Invalid Date" && !isNaN(Date.parse(item))) {
					doc[name.toLowerCase().replace(/[\s-\/]+/gi,"_").replace(/[\.()]/gi,"")+ "_d"] = new Date(Date.parse(item));
				} else if (item.length !=0){
				    // index string
				    doc[name.toLowerCase().replace(/[\s-\/]+/gi,"_").replace(/[\.()]/gi,"")] = item;
				}

			});
			doc.origin = "parser";
			doc.class = path;
			doc.sensor = "local";
			doc.date = getDateInt();
			doc.message = d.replace(/,/gi, " ");
			conn.publish(amqp_config.work_queue, {body: doc});
			//console.log(JSON.stringify(doc));
			return doc;

		}
	}).join(function(j) { console.log("join"); });
	return 0;
}
function setup() {
	queue = conn.queue(amqp_config.work_queue, {durable: false, exclusive: false, "x-message-ttl": 1000 * 60},
	function() {
//		dive("/tmp/filez/", imdata);
//		dive("/var/opt/data1", imdata);
		dive("/var/opt/data2", imdata);
		dive("/var/opt/data3", imdata);
	});
}



conn = amqp.createConnection({url: amqp_config.url});
conn.on('ready', setup);

//dive("/var/opt/data1", imdata);
//dive("/var/opt/data2", imdata);
//console.log("data3");
//dive("/var/opt/data3", imdata);
console.timeEnd("import");


// refactor getDateInt into utils.. or something
var padInteger = function(number) {
    return (number < 10 ? '0' : '') + number.toString()    
}



var getDateInt = function() {
    var d = new Date()
    var dateline = padInteger(d.getFullYear()) + padInteger(d.getMonth()+1) + padInteger(d.getDate()) + padInteger(d.getHours())+ padInteger(d.getMinutes()) + padInteger(d.getSeconds())
    return parseInt(dateline)

}


