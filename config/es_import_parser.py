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
index="everlog_parser"
f = open("parser.conf", "r").readlines()

mapping = {
           u'type': {'boost': 1.0,
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"},
           u'rule': {'boost': 1.0,
                 'index': 'analyzed',
                 'store': 'yes',
                 'type': u'string',
                 "term_vector" : "with_positions_offsets"}
}
conn.create_index('everlog_parser')
conn.put_mapping("everlog_parser-type", {'properties':mapping}, 'everlog_parser')
for ln in f:
	ln=ln[0:len(ln) - 1]
    if (ln.find('===>') > 0:
        key = ln[0:ln.find('===>')]
        val =ln[ln.find('===>')+4:len(ln)]
        conn.index({"type": key, "rule": val}, "everlog_parser", "everlog_parser-type")

#conn.put_mapping("malwr-type", {'properties':mapping}, [getindex()])
#conn.put_mapping(doc_type="searchindex-type", mapping = mapping, indices=[getindex()])



