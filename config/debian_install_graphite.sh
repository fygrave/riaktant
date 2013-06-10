#!/bin/bash

# statsd + graphite
git clone https://github.com/etsy/statsd.git
pip install graphite-web pip install  pytz python-pyparsing tagging python-memcache ldap python-rrdtool
pip install warden
pip install carbon
pip install whisper
pip install Django==1.3.1 
pip install django-tagging==0.3.1
echo '

{
  graphitePort: 2003
, graphiteHost: "localhost"
, port: 8125
, backends: [ "./backends/graphite" ]
}
' >> statsd/everlog.js

echo '
[program:statsd]
directory=/root/statsd/
command = node statsd.js everlog.js
autostart = true
autorestart = true
' >> /etc/supervisor/conf.d/statsd.conf

echo "Listen 81" >> /etc/apache/ports.conf

cp graphite_apache.conf /etc/apache/conf.d/

for f in aggregation-rules.conf  carbon.conf  dashboard.conf  storage-aggregation.conf  storage-schemas.conf;
do
    cp /opt/graphite-web/conf/$f.example /opt/graphite-web/conf/$f

done
echo '
[carbon]
pattern = ^carbon\.
retentions = 60:90d

[default_1min_for_1day]
pattern = .*
retentions = 60s:395d
' > /opt/graphite-web/conf/storage-schemas.conf
/etc/init.d/apache2 restart

