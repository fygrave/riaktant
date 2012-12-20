#!/bin/sh
  openssl genrsa -des3 -out server.key 1024
  openssl req -new -key server.key -out server.csr
  mv server.key server.org.key
  openssl rsa -in server.org.key -out server.key
  openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
  openssl rsa -in server.key -pubout > server.pub

