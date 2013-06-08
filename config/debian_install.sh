#!/bin/sh

SOLRV="4.3.0"
RIAKV="1.2.1-1"
apt-get -y install shorewall
apt-get -y install openvpn
apt-get -y install curl build-essential
[ -f riak_"$RIAKV"_amd64.deb ] || wget http://downloads.basho.com.s3-website-us-east-1.amazonaws.com/riak/CURRENT/debian/6/riak_"$RIAKV"_amd64.deb
[ -f rabbitmq-server_2.8.4-1_all.deb ] || curl http://www.rabbitmq.com/releases/rabbitmq-server/v2.8.4/rabbitmq-server_2.8.4-1_all.deb -o rabbitmq-server_2.8.4-1_all.deb
[ -f apache-solr-$SOLRV.tgz ] || curl  http://apache.cdpa.nsysu.edu.tw/lucene/solr/$SOLRV/apache-solr-$SOLRV.tgz -o apache-solr-$SOLRV.tgz
tar xvfz apache-solr-$SOLRV.tgz
#wget http://nodejs.org/dist/v0.8.4/node-v0.8.4.tar.gz
#tar xvfz node-v0.8.4.tar.gz
#cd node-v0.8.4
#./configure
#make
#make install
apt-get -y install apache2
apt-get -y install build-essential openjdk-6-jdk  apache2 libssl-dev pkg-config curl libcurl4-openssl-dev php5-curl php-pear php5-memcache memcached supervisor git
apt-get -y install erlang-nox
apt-get -y install erlang-base
apt-get -y install php-pear
apt-get -y install libxml2-dev
apt-get -y install libssl0.9.8
apt-get -y install libssl0.9.8
apt-get -y install munin munin-node
apt-get -y install python-pip
pecl install -n solr
apt-get -y -f install
dpkg -i riak_"$RIAKV"_amd64.deb
#[ -f node-v0.6.18.tar.gz ] || wget http://nodejs.org/dist/v0.6.18/node-v0.6.18.tar.gz
#tar xvfz node-v0.6.18.tar.gz
#cd node-v0.6.18/
pip install graphite-web warden
pip install carbon
pip install whisper

[ -f elasticsearch-0.90.1.tar.gz ] || wget https://download.elasticsearch.org/elasticsearch/elasticsearch/elasticsearch-0.90.1.tar.gz

[ -f node-v0.8.16.tar.gz ] || wget http://nodejs.org/dist/v0.8.16/node-v0.8.16.tar.gz
tar xvfz node-v0.8.16.tar.gz
cd node-v0.8.16/
./configure && make && make install && supervisorctl restart all
cd ..
curl https://npmjs.org/install.sh | sh
dpkg -i rabbitmq rabbitmq-server_2.8.4-1_all.deb
rabbitmq-plugins enable rabbitmq_management
npm install forever -g
git clone http://github.com/fygrave/riaktant.git
cd riaktant
npm install
cd ..
cp riaktant/config/schema.xml apache-solr-$SOLRV/example/solr/collection1/conf/schema.xml
cp riaktant/config/supervisor_master.conf /etc/supervisor/conf.d/
/etc/init.d/apache2 restart
/etc/init.d/rabbitmq-server restart
killall supervisord
/etc/init.d/supervisor restart
mv /etc/riak/app.config /etc/riak/app.config.bk && sed -e 's/riak_kv_bitcask_backend/riak_kv_eleveldb_backend/' /etc/riak/app.config.bk  > /etc/riak/app.config
MYIP=`/sbin/ifconfig eth0 | grep "inet addr" | awk -F: '{print $2}' | awk '{print $1}'`
echo $MYIP
NODE="riak@$MYIP"
mv /etc/riak/vm.args /etc/riak/vm.args.bk && sed -e "s/riak@127.0.0.1/$NODE/" /etc/riak/vm.args.bk  > /etc/riak/vm.args
rm -rf /var/lib/riak/*

/etc/init.d/riak restart
echo "run riak-admin join <masternode>"

