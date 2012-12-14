#!/bin/sh

apt-get install curl
[ -f riak_1.2.1-1_amd64.deb ] || curl http://downloads.basho.com.s3-website-us-east-1.amazonaws.com/riak/CURRENT/ubuntu/precise/riak_1.2.1-1_amd64.deb -o riak_1.2.1-1_amd64.deb
[ -f rabbitmq-server_2.8.4-1_all.deb ] || curl http://www.rabbitmq.com/releases/rabbitmq-server/v2.8.4/rabbitmq-server_2.8.4-1_all.deb -o rabbitmq-server_2.8.4-1_all.deb
[ -f apache-solr-4.0.0.tgz ] || curl  http://apache.cdpa.nsysu.edu.tw/lucene/solr/4.0.0/apache-solr-4.0.0.tgz -o apache-solr-4.0.0.tgz
tar xvfz apache-solr-4.0.0.tgz
#wget http://nodejs.org/dist/v0.8.4/node-v0.8.4.tar.gz
#tar xvfz node-v0.8.4.tar.gz
#cd node-v0.8.4
#./configure
#make
#make install
curl http://npmjs.org/install.sh | sh
cd ..
apt-get install build-essential openjdk-6-jdk  libssl-dev pkg-config curl libcurl4-openssl-dev php5-curl php5-pecl php5-memcache memcached supervisor git
apt-get install erlang-nox
apt-get install erlang-base
apt-get install php-pecl
apt-get install php-pear
apt-get install libxml2-dev
apt-get install libssl0.9.8
apt-get install libssl0.9.8
apt-get install munin munin-node
pecl install -n solr
apt-get -f install
dpkg -i riak_1..2.1-1_amd64.deb
[ -f node-v0.6.18.tar.gz ] || wget http://nodejs.org/dist/v0.6.18/node-v0.6.18.tar.gz
tar xvfz node-v0.6.18.tar.gz
cd node-v0.6.18/
./configure && make && make install && supervisorctl restart all
cd ..
sudo curl http://npmjs.org/install.sh | sh
rabbitmq-plugins enable rabbitmq_management
npm install forever -g
git clone http://github.com/fygrave/riaktant.git
cd riaktant
npm install
cp riaktant/config/schema.xml apache-solr-4.0.0/example/solr/collection1/conf/
