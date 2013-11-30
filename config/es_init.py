#!/usr/bin/env python

import sys
import os
import datetime
import time
#from dateutil import parser
#import redis
import json
os.environ["DJANGO_SETTINGS_MODULE"] =  "settings"# pyes + django bug(?)
from pyes import *
import sys
print sys.argv[1]
conn = ES([sys.argv[1]])
#reclient = redis.Redis(host='localhost', port=6833)
number_of_nodes = pyes.cluster_nodes()

mapping = {'searchindex-type' : {
    "_all": { "enabled" : False},
    "dynamic": "strict",

#           u'_id': { 'path': u'md5' },
	"dynamic_templates": [
		{
		"template_1": {
			"match": "*_ip",
			"mapping": {
				'store': 'yes',
				'type': 'ip'
			}}}, {
		#"template_2": {
		#	"match": "*_s",
		#	"mapping": {
		#		'store': 'yes',
		#		 'index': 'not_analyzed',
		#		'type': 'string'
		#	},
		"template_3": {
			"match": "*_i",
			"mapping": {
				'store': 'yes',
				'type': 'integer'
			}}}, {
		"template_4": {
			"match": "*",
			"mapping": {
				'store': 'yes',
				 'index': 'not_analyzed',
				'type': 'string'
			}}}



	], "properties": {



	   u'alert': { 'boost': 1.0, 'type': 'integer', 'store': 'yes' },
           u'classify': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'ref': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'note': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'status': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'originalMessage': {'boost': 1.0,
                 'index': 'analyzed',
                 'store': 'yes',
		 'analyzer':'snowball',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'origin': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'host': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'version': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'src': {'boost': 1.0,
                 'store': 'yes',
                 'type': u'ip' },
           u'dst': {'boost': 1.0,
                 'store': 'yes',
                 'type': u'ip' },
           u'sensor': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
	   u'priority': { 'boost': 1.0, 'type': 'integer', 'store': 'yes' },
	   u'prival': { 'boost': 1.0, 'type': 'integer', 'store': 'yes' },
	   u'severityID': { 'boost': 1.0, 'type': 'integer', 'store': 'yes' },
	   u'facilityID': { 'boost': 1.0, 'type': 'integer', 'store': 'yes' },
           u'severity': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'facility': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'tag': {'boost': 1.0,
                 'index': 'analyzed',
                 'store': 'yes',
		 'analyzer':'snowball',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'program': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'protocol': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'protocol': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'generated': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'signature': {'boost': 1.0,
                 'index': 'not_analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
   u'time': { 'boost':1.0,
			'index': 'analyzed', 'store': 'yes', 'type': 'date', 'format': 'date_time'}
                }}}

template= { "template": "searchindex*",
        "settings": {
            "index": {
                "routing.allocation.total_shards_per_node": 1,
                  "refresh_interval": 60,
                  "number_of_shards": number_of_nodes,
                  "number_of_replicas": 0,
          "analysis": {
            "analyzer" : {
          "log_analyzer" : {
            "type" : "custom",
            "tokenizer": "pattern",
            "filter": ["lowercase"]
                      }
                    }
                }
            }
            },
        "mappings": mapping
        }
conn._send_request(method='PUT', path='/_template/template1/', body=template)
conn.index({"originalMessage": "test"}, "searchindex-2233", "searchindex-type")

#conn.put_mapping("malwr-type", {'properties':mapping}, [getindex()])
#conn.put_mapping(doc_type="searchindex-type", mapping = mapping, indices=[getindex()])



