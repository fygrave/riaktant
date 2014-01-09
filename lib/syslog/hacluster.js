var zmq = require('zmq'),
os = require('os'),
util = require('util'),
events = require('events');

function HACluster(url) {

this.url = url || 'pgm://224.0.3.3:3333';
this.period =  2000;
this.ident = this.node_name();
this.is_master = false;
this.master = null;
this.old_master = null;
this.last_update = Date.now();
this.master_interval = null;
this.min_skew = 5000;
this.max_age = 4000;
}

util.inherits(HACluster, events.EventEmitter);



HACluster.prototype.node_name = function() {
    return os.hostname();
}

HACluster.prototype.start_master = function() {
    var self = this;
//    console.log("start master");

    self.old_master = self.master;
    self.master = self.node_name();
    self.is_master = true;       
    self.master_interval = setInterval(function(){
	self.sock.send("heartbeat " + self.node_name());
    }, self.period);
   
    this.emit('masterChanged', this.master, this.old_master);
  
}

HACluster.prototype.stop_master =function(_master) {
  //  console.log("stop master because new master is" + _master);
    this.is_master = false;
    this.old_master = this.master;
    this.master = _master;
    clearInterval(this.master_interval);
    this.emit('masterChanged', this.master, this.old_master);
}


HACluster.prototype.check_master = function() {
    var self = this;
  //  console.log("check master");
    if (self.is_master == false) {
	if ((Date.now() - self.last_update) > self.max_age) {
	    self.start_master();
	} 
    }
}

HACluster.prototype.isMaster = function () {
    return this.is_master;
}



HACluster.prototype.start = function(period, min_skew, max_age) {
    var self = this;
    this.period = period || 2000;
    this.min_skew = min_skew || 5000;
    this.max_age = max_age || 4000;
    this.last_update = Date.now();
    this.sock = zmq.socket('pub');
    this.last_update = Date.now();
    this.sock2 = zmq.socket('sub');
    this.sock.identify = 'pub_' + this.node_name();
    this.sock2.identity = 'sub_' + this.node_name();

    this.sock.bind(this.url, function(err){ 
       if (err) { throw err; };
    });


    this.sock2.connect(this.url);
    this.sock2.subscribe('heartbeat');

    setInterval(function() { 
	self.check_master(); 
//	console.log("master " + self.master + " is master " + self.is_master); 
    }, self.period);
    
    this.sock2.on('message', function(data) { 
	//console.log(self.sock2.identity + " received " + data.toString());
	m = data.toString().split(' ');
	if (m[0] == 'heartbeat' && m[1] != self.node_name()) {
	    if (self.is_master) {
		self.stop_master(m[1]);
            }
	    self.last_update = Date.now();
	    self.master = m[1];
	}
    });
 
}




module.exports = HACluster;

