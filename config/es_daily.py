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
def getindex():
    index_name = 'searchindex-%.4i%.2i%.2i'% (datetime.datetime.now().year, datetime.datetime.now().month, datetime.datetime.now().day)
    return index_name
#reclient = redis.Redis(host='localhost', port=6833)
number_of_nodes = len(conn.cluster_nodes()["nodes"])
conn.add_alias("searchindex", indices=[ getindex()])
conn.optimize(indices=[getindex()])
#conn.index({"originalMessage": "test"}, "searchindex-2233", "searchindex-type")

#conn.put_mapping("malwr-type", {'properties':mapping}, [getindex()])
#conn.put_mapping(doc_type="searchindex-type", mapping = mapping, indices=[getindex()])



