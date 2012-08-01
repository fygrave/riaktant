#!/bin/sh

apt-get install build-essential openjdk-6-jdk  openssl libssl-dev pkg-config curl libcurl4-openssl-dev php5-curl php5-pecl php5-memcache memcached supervisor git
wget http://www.rabbitmq.com/releases/rabbitmq-server/v2.8.4/rabbitmq-server_2.8.4-1_all.deb
dpkg -i rabbitmq-server_2.8.4-1_all.deb
apt-get install erlang-nox
apt-get -f install
rabbitmq-plugins enable rabbitmq_management
wget http://nodejs.org/dist/v0.8.4/node-v0.8.4.tar.gz
tar xvfz node-v0.8.4.tar.gz
cd node-v0.8.4
./configure
make
make install
curl http://npmjs.org/install.sh | sh
cd ..

pecl install -n solr

npm install forever -g

git clone http://github.com/fygrave/riaktant.git
cd riaktant
npm install
