var config = require("./config/config.js"),
    amqp_config = require("./config/amqp.js"),
    syslogParser = require('glossy').Parse,
    dgram = require('dgram'),
    solr = require('solr'),
    riak = require('riak-js'),
    crypto = require('crypto'),
    amqp = require('amqp');


var db = riak.getClient(config)
var solrc = solr.createClient(config.solr_params);

function houseKeeping() {

	v = db.get('system_config', 'SystemAttr', function(err, d, meta) {
		if (err) {
			return;
		}
		data  = JSON.parse(d);
		days = parseInt(data.housekeeping_days);
		if (days > 0) {
			//console.log("house keeping " + days);
			solrc.del(null, "timestamp:[NOW-5YEAR TO NOW-"+ days + "DAY]", function() { solrc.commit() });
		}


	});


}
setInterval(houseKeeping, 5 * 1000);
