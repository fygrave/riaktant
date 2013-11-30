var config = require("./config/config.js");

if (config.backend == 'ES') {
	amqp_syslog = require("./lib/syslog/server_amqp_worker_es")
} else {
	amqp_syslog = require("./lib/syslog/server_amqp_worker")
}

