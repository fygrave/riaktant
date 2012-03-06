var syslogProducer = require('glossy').Produce,
    dgram = require('dgram');

var producer = new syslogProducer();
var host = "127.0.0.1";

var services = ['sendmail', 'ntpd', 'ftpd', 'sshd', 'nginx']
var messages = [
  'Client disconnected',
  'Connection to node.basho.com closed unexpectedly',
  'Rotated logs',
  'Mar 05 2012 22:21:01: %ASA-4-106023: Deny udp src inside:10.134.1.53/51884 dst outside:118.123.243.47/17788 by access-group "inside_access_in" [0x0, 0x0]',
  'Mar 05 2012 22:21:02: %ASA-6-302013: Built inbound TCP connection 485784501 for outside:115.238.61.212/4413 (115.238.61.212/4413) to dmz:SPAM3/25 (SPAM3/25)',
  'Mar 05 2012 22:21:02: %ASA-6-106015: Deny TCP (no connection) from Tomcat/139 to 10.129.2.5/2938 flags SYN ACK  on interface inside',
  'Mar 05 2012 22:21:01: %ASA-6-302016: Teardown UDP connection 485784498 for outside:168.95.1.1/53 to inside:SC-VG/4339 duration 0:00:00 bytes 170',
  'Mar 05 2012 22:21:03: %ASA-4-500004: Invalid transport field for protocol=UDP, from 10.130.1.85/1314 to 14.221.15.44/0',
  'Mar 05 2012 22:21:03: %ASA-4-419002: Duplicate TCP SYN from inside:officescan/57199 to inside:192.168.1.6/23999 with different initial sequence number',
  'Mar 05 2012 22:21:05: %ASA-6-106015: Deny TCP (no connection) from 116.24.85.100/14172 to 222.220.141.95/10001 flags RST ACK  on interface inside',
  '2012:03:05-22:21:05 ulogd[5472]: id="2001" severity="info" sys="SecureNet" sub="packetfilter" name="Packet dropped" action="drop" fwrule="60001" initf="eth1" mark="0x323d" app="573" srcmac="0:30:88:1:43:cd" dstmac="0:1a:8c:12:2b:59" srcip="83.38.75.151" dstip="210.66.55.107" proto="17" length="63" tos="0x00" prec="0x00" ttl="109" srcport="4672" dstport="17505',
  'Client process died before closing connection, cleaning up',
    'Received unexpected packet from remote host',
    '[4832626.922984] Shorewall:net2fw:REJECT:IN=eth0 OUT= MAC=00:21:9b:fc:32:93:00:12:d9:86:96:c2:08:00 SRC=60.173.10.165 DST=140.109.17.116 LEN=40 TOS=0x00 PREC=0x00 TTL=106 ID=256 PROTO=TCP SPT=6000 DPT=9415 WINDOW=16384 RES=0x00 SYN URGP=0',
    '[origin software="rsyslogd" swVersion="4.6.4" x-pid="4282" x-info="http://www.rsyslog.com"] rsyslogd was HUPed, type \'lightweight\'.',
    ' authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=221.181.1.155  user=root',
    'Failed password for root from 221.181.1.155 port 60757 ssh2',
    'pam_unix(cron:session): session opened for user root by (uid=0)',
    ' pam_unix(cron:session): session closed for user root',
    'Invalid user info from 91.194.111.249'
]

var severities = [
    "emerg",    // Emergency: system is unusable
    "alert",    // Alert: action must be taken immediately
    "crit",     // Critical: critical conditions
    "err",      // Error: error conditions
    "warn",     // Warning: warning conditions
    "notice",   // Notice: normal but significant condition
    "info",     // Informational: informational messages
    "debug"     // Debug: debug-level messages
];

var facilities = [
    "kern",     // kernel messages
    "user",     // user-level messages
    "mail",     // mail system
    "daemon",   // system daemons
    "auth",     // security/authorization messages
    "syslog",   // messages generated internally by syslogd
    "lpr",      // line printer subsystem
    "news",     // network news subsystem
    "uucp",     // UUCP subsystem
    "clock",    // clock daemon
    "sec",      // security/authorization messages
    "ftp",      // FTP daemon
    "ntp",      // NTP subsystem
    "audit",    // log audit
    "alert",    // log alert
    "clock",    // clock daemon (note 2)
    "local0",   // local use 0  (local0)
    "local1",   // local use 1  (local1)
    "local2",   // local use 2  (local2)
    "local3",   // local use 3  (local3)
    "local4",   // local use 4  (local4)
    "local5",   // local use 5  (local5)
    "local6",   // local use 6  (local6)
    "local7",   // local use 7  (local7)
];

var hosts = ['app1.usim.com', 'web2.usim.com', 'node5.usim.com', 'lb.usim.com']

var dgram = require('dgram');
var client = dgram.createSocket("udp4");
var msg;

function date() {
  var minute = parseInt(Math.random() * 100) % 60;
  var hour = parseInt(Math.random() * 100) % 24;
  var date = new Date();
  date.setHours(hour);
  date.setMinutes(minute);
  return date;
}

for (var i = 0; i < 20; i++) {
  var facility = parseInt(Math.random() * 100) % facilities.length;
  if (facility == 0) facility = 1;
  var severity = parseInt(Math.random() * 100) % severities.length;
  if (severity == 0) severity = 1;
  var hsh = {
    facility: facilities[facility],
    severity: severities[severity],
    host: hosts[parseInt(Math.random() * 100) % hosts.length],
    app_id: services[parseInt(Math.random() * 100) % services.length],
    pid: parseInt(Math.random() * 100000) % 65535,
    date: date(),
    message: messages[parseInt(Math.random() * 100) % messages.length]
  }
  var msg = producer.produce(hsh)
  console.log(msg);
  var message = new Buffer(msg);
  client.send(message, 0, message.length, 10514, host, function(err) {
	console.log("done");
	if (err) { throw err; }
});
}

console.log("completed");
//client.close();
